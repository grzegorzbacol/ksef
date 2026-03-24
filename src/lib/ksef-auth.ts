/**
 * Automatyczne logowanie do KSeF za pomocą tokena MCU (challenge → encrypt → redeem).
 * Wydzielone z /api/ksef/login-token/route.ts, aby umożliwić automatyczne odnawianie sesji
 * gdy zarówno access token jak i refresh token wygasną.
 */

import { X509Certificate, createPublicKey, publicEncrypt, constants, KeyObject } from "crypto";

type ChallengeResponse = {
  challenge?: string;
  timestamp?: string;
  timestampMs?: number | string;
};

export type KsefLoginResult = {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
};

const timestampMsFromChallenge = (ch: ChallengeResponse): number | undefined => {
  if (ch.timestampMs != null) {
    const n = typeof ch.timestampMs === "string" ? parseInt(ch.timestampMs, 10) : ch.timestampMs;
    return Number.isNaN(n) ? undefined : n;
  }
  if (ch.timestamp) {
    const n = new Date(ch.timestamp).getTime();
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
};

const chunk64 = (input: string) => input.match(/.{1,64}/g)?.join("\n") ?? input;

const normalizeCert = (certificate: string): { certDer: Buffer; certPem: string } => {
  const compact = certificate.replace(/\s/g, "");
  const maybePem = compact.toUpperCase().includes("BEGINCERTIFICATE");
  let b64 = compact;
  if (maybePem) {
    const m = /-----BEGINCERTIFICATE-----([A-Za-z0-9+/=]+)-----ENDCERTIFICATE-----/.exec(compact);
    b64 = (m?.[1] ?? compact.replace(/-----BEGINCERTIFICATE-----|-----ENDCERTIFICATE-----/g, "")).trim();
  }
  const certPem = `-----BEGIN CERTIFICATE-----\n${chunk64(b64)}\n-----END CERTIFICATE-----\n`;
  return { certDer: Buffer.from(b64, "base64"), certPem };
};

const canonicalTokenVariants = (rawToken: string): Array<{ label: string; token: string }> => {
  const parts = rawToken
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const full = parts.length > 0 ? parts.join("|") : rawToken.trim();
  const secret = parts.length >= 3 ? parts[parts.length - 1]! : full;
  if (secret === full) return [{ label: "token", token: full }];
  return [
    { label: "full", token: full },
    { label: "secret", token: secret },
  ];
};

const isInvalidEncryption = (detail: string) => {
  const x = detail.toLowerCase();
  return x.includes("invalid") && x.includes("encryption");
};

const parseDetail = (text: string): string => {
  try {
    const j = JSON.parse(text) as { message?: string; details?: string; exceptionDescription?: string };
    return (j.details ?? j.message ?? j.exceptionDescription ?? text).slice(0, 400);
  } catch {
    return text.slice(0, 400);
  }
};

/**
 * Loguje się do KSeF za pomocą tokena MCU (challenge → szyfrowanie RSA → polling → redeem).
 * Zwraca parę accessToken + refreshToken lub błąd.
 */
export async function loginWithMcuToken(
  apiUrl: string,
  mcuToken: string,
  nip: string,
): Promise<KsefLoginResult> {
  const base = `${apiUrl.replace(/\/$/, "")}/v2`;

  if (!mcuToken || /[^\x00-\x7F]/.test(mcuToken)) {
    return { ok: false, error: "Brak lub nieprawidłowy token MCU." };
  }
  const nip10 = nip.replace(/\D/g, "");
  if (nip10.length !== 10) {
    return { ok: false, error: "Brak prawidłowego NIP (10 cyfr)." };
  }

  try {
    // 1. Pobierz klucz publiczny KSeF
    const keyRes = await fetch(`${base}/security/public-key-certificates`);
    if (!keyRes.ok) {
      return { ok: false, error: "Nie udało się pobrać klucza publicznego KSEF." };
    }
    const keyJson = (await keyRes.json()) as unknown;
    const rows = Array.isArray(keyJson)
      ? keyJson
      : (keyJson as { items?: unknown[] }).items ?? (keyJson as { certificates?: unknown[] }).certificates ?? [keyJson];
    type CertRow = { certificate?: string; usage?: string | string[] };
    const certRow = (rows as CertRow[]).find((c) =>
      Array.isArray(c.usage) ? c.usage.includes("KsefTokenEncryption") : c.usage === "KsefTokenEncryption"
    );
    const certificate = certRow?.certificate ?? (rows as CertRow[])[0]?.certificate;
    if (!certificate) {
      return { ok: false, error: "Brak certyfikatu KsefTokenEncryption." };
    }

    const { certDer, certPem } = normalizeCert(certificate);
    let keyObject: KeyObject | null = null;
    try {
      keyObject = new X509Certificate(certDer).publicKey;
    } catch {
      try {
        keyObject = createPublicKey(certPem);
      } catch {
        keyObject = null;
      }
    }

    const tokenVariants = canonicalTokenVariants(mcuToken);
    const keyModes: Array<{ label: string; mode: "pem" | "keyobj" }> = [{ label: "pem", mode: "pem" }];
    if (keyObject) keyModes.push({ label: "keyobj", mode: "keyobj" });

    // 2. Próba logowania: challenge → encrypt → init → poll → redeem
    for (const t of tokenVariants) {
      for (const tsMode of ["ms", "iso"] as const) {
        for (const km of keyModes) {
          const challengeRes = await fetch(`${base}/auth/challenge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          if (!challengeRes.ok) continue;

          const ch = (await challengeRes.json()) as ChallengeResponse;
          const challenge = ch.challenge;
          const tsMs = timestampMsFromChallenge(ch);
          const tsIso = ch.timestamp;
          if (!challenge || tsMs == null) continue;
          if (tsMode === "iso" && !tsIso) continue;

          const tsValue = tsMode === "ms" ? String(tsMs) : tsIso!;
          const payload = `${t.token}|${tsValue}`;
          let encryptedToken: string;
          try {
            const keyForEncrypt = km.mode === "pem" ? certPem : keyObject!;
            encryptedToken = publicEncrypt(
              {
                key: keyForEncrypt,
                padding: constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: "sha256",
                oaepLabel: Buffer.alloc(0),
              },
              Buffer.from(payload, "utf8"),
            ).toString("base64");
          } catch {
            continue;
          }

          const initRes = await fetch(`${base}/auth/ksef-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              challenge,
              contextIdentifier: { type: "Nip", value: nip10 },
              encryptedToken,
            }),
          });
          const initText = await initRes.text();
          if (!initRes.ok) {
            const detail = parseDetail(initText);
            if ((initRes.status === 450 || initRes.status === 401) && isInvalidEncryption(detail)) continue;
            return { ok: false, error: `KSEF zwrócił ${initRes.status}: ${detail}` };
          }

          const initData = JSON.parse(initText) as { authenticationToken?: { token?: string }; referenceNumber?: string };
          const authToken = initData.authenticationToken?.token;
          const referenceNumber = initData.referenceNumber;
          if (!authToken || !referenceNumber) continue;

          // Polling
          let pollOk = false;
          for (let i = 0; i < 25; i++) {
            await new Promise((r) => setTimeout(r, i === 0 ? 600 : 1500));
            const statusRes = await fetch(`${base}/auth/${encodeURIComponent(referenceNumber)}`, {
              headers: { Authorization: `Bearer ${authToken}` },
            });
            if (!statusRes.ok) break;
            const statusData = (await statusRes.json()) as { status?: { code?: number } };
            const code = statusData.status?.code ?? 0;
            if (code === 200) { pollOk = true; break; }
            if (code >= 400) break;
          }
          if (!pollOk) continue;

          // Redeem
          const redeemRes = await fetch(`${base}/auth/token/redeem`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          });
          const redeemText = await redeemRes.text();
          if (!redeemRes.ok) {
            return { ok: false, error: `Wymiana tokena nie powiodła się: ${parseDetail(redeemText)}` };
          }

          const redeemData = JSON.parse(redeemText) as {
            accessToken?: { token?: string };
            refreshToken?: { token?: string };
          };
          const accessToken = redeemData.accessToken?.token;
          const refreshToken = redeemData.refreshToken?.token;
          if (!accessToken) {
            return { ok: false, error: "Brak accessToken w odpowiedzi KSEF." };
          }

          return { ok: true, accessToken, refreshToken: refreshToken ?? undefined };
        }
      }
    }

    return { ok: false, error: "Wszystkie warianty logowania MCU zakończyły się niepowodzeniem." };
  } catch (e) {
    return { ok: false, error: `Błąd logowania MCU: ${e instanceof Error ? e.message : String(e)}` };
  }
}
