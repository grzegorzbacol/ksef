import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { X509Certificate, createPublicKey, publicEncrypt, constants, KeyObject } from "crypto";

type ChallengeResponse = {
  challenge?: string;
  timestamp?: string;
  timestampMs?: number | string;
};

type AttemptLog = {
  attempt: string;
  stage: "init" | "poll" | "redeem";
  status?: number;
  detail: string;
};

const parseDetail = (text: string): string => {
  try {
    const j = JSON.parse(text) as { message?: string; details?: string; exceptionDescription?: string };
    return (j.details ?? j.message ?? j.exceptionDescription ?? text).slice(0, 400);
  } catch {
    return text.slice(0, 400);
  }
};

const isInvalidEncryption = (detail: string) => {
  const x = detail.toLowerCase();
  return x.includes("invalid") && x.includes("encryption");
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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const apiUrl = String((body.apiUrl as string) ?? "https://api.ksef.mf.gov.pl").trim().replace(/\/$/, "");
  const rawToken = String((body.token as string) ?? "").trim();
  const nip = String((body.nip as string) ?? "").replace(/\D/g, "");
  const base = `${apiUrl}/v2`;

  if (!rawToken) {
    return NextResponse.json({ ok: false, error: "Wpisz token z MCU (Moduł certyfikatów i uprawnień)." });
  }
  if (/[^\x00-\x7F]/.test(rawToken)) {
    return NextResponse.json({ ok: false, error: "Token może zawierać tylko znaki ASCII." });
  }
  if (nip.length !== 10) {
    return NextResponse.json({ ok: false, error: "Podaj prawidłowy NIP (10 cyfr)." });
  }

  try {
    const keyRes = await fetch(`${base}/security/public-key-certificates`);
    if (!keyRes.ok) {
      return NextResponse.json({
        ok: false,
        error: "Nie udało się pobrać klucza publicznego KSEF.",
        detail: (await keyRes.text()).slice(0, 300),
      });
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
      return NextResponse.json({ ok: false, error: "Brak certyfikatu KsefTokenEncryption w odpowiedzi KSEF." });
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

    const tokenVariants = canonicalTokenVariants(rawToken);
    const keyModes: Array<{ label: string; mode: "pem" | "keyobj" }> = [{ label: "pem", mode: "pem" }];
    if (keyObject) keyModes.push({ label: "keyobj", mode: "keyobj" });

    const attemptLogs: AttemptLog[] = [];

    for (const t of tokenVariants) {
      for (const tsMode of ["ms", "iso"] as const) {
        for (const km of keyModes) {
          const attemptName = `${t.label}-${tsMode}-${km.label}`;

          const challengeRes = await fetch(`${base}/auth/challenge`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          if (!challengeRes.ok) {
            attemptLogs.push({
              attempt: attemptName,
              stage: "init",
              status: challengeRes.status,
              detail: "Nie udało się pobrać challenge.",
            });
            continue;
          }
          const ch = (await challengeRes.json()) as ChallengeResponse;
          const challenge = ch.challenge;
          const tsMs = timestampMsFromChallenge(ch);
          const tsIso = ch.timestamp;
          if (!challenge || tsMs == null) {
            attemptLogs.push({
              attempt: attemptName,
              stage: "init",
              detail: "Challenge bez challenge/timestamp.",
            });
            continue;
          }
          if (tsMode === "iso" && !tsIso) {
            attemptLogs.push({
              attempt: attemptName,
              stage: "init",
              detail: "Brak timestamp ISO dla wariantu iso.",
            });
            continue;
          }

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
              Buffer.from(payload, "utf8")
            ).toString("base64");
          } catch (e) {
            attemptLogs.push({
              attempt: attemptName,
              stage: "init",
              detail: `Błąd szyfrowania: ${e instanceof Error ? e.message : String(e)}`.slice(0, 400),
            });
            continue;
          }

          const initRes = await fetch(`${base}/auth/ksef-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              challenge,
              contextIdentifier: { type: "Nip", value: nip },
              encryptedToken,
            }),
          });
          const initText = await initRes.text();
          if (!initRes.ok) {
            const detail = parseDetail(initText);
            attemptLogs.push({
              attempt: attemptName,
              stage: "init",
              status: initRes.status,
              detail,
            });
            if ((initRes.status === 450 || initRes.status === 401) && isInvalidEncryption(detail)) {
              continue;
            }
            return NextResponse.json({
              ok: false,
              error: initRes.status === 401 ? "KSEF odrzucił token (401)." : `KSEF zwrócił ${initRes.status}.`,
              detail,
            });
          }

          const initData = JSON.parse(initText) as { authenticationToken?: { token?: string }; referenceNumber?: string };
          const authToken = initData.authenticationToken?.token;
          const referenceNumber = initData.referenceNumber;
          if (!authToken || !referenceNumber) {
            attemptLogs.push({
              attempt: attemptName,
              stage: "init",
              detail: "Brak authenticationToken/referenceNumber.",
            });
            continue;
          }

          let pollCode = 0;
          let pollDetail = "";
          let pollOk = false;
          for (let i = 0; i < 25; i++) {
            await new Promise((r) => setTimeout(r, i === 0 ? 600 : 1500));
            const statusRes = await fetch(`${base}/auth/${encodeURIComponent(referenceNumber)}`, {
              headers: { Authorization: `Bearer ${authToken}` },
            });
            if (!statusRes.ok) {
              pollCode = statusRes.status;
              pollDetail = `HTTP ${statusRes.status} przy pollingu.`;
              break;
            }
            const statusData = (await statusRes.json()) as { status?: { code?: number; description?: string; details?: string[] } };
            pollCode = statusData.status?.code ?? 0;
            pollDetail = statusData.status?.details?.join("; ") ?? statusData.status?.description ?? "";
            if (pollCode === 200) {
              pollOk = true;
              break;
            }
            if (pollCode >= 400) break;
          }

          if (!pollOk) {
            attemptLogs.push({
              attempt: attemptName,
              stage: "poll",
              status: pollCode || undefined,
              detail: pollDetail || "Polling bez sukcesu.",
            });
            if (pollCode === 450 && isInvalidEncryption(pollDetail)) {
              continue;
            }
            return NextResponse.json({
              ok: false,
              error: pollCode === 450
                ? "Token KSeF odrzucony (450). Sprawdź: token aktualny i nieużyty, NIP zgodny z tokenem, URL to to samo środowisko (produkcja/demo) co portal MCU."
                : `Uwierzytelnianie nie powiodło się (${pollCode || "?"}).`,
              detail: pollDetail || "Brak szczegółów błędu.",
            });
          }

          const redeemRes = await fetch(`${base}/auth/token/redeem`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          });
          const redeemText = await redeemRes.text();
          if (!redeemRes.ok) {
            const detail = parseDetail(redeemText);
            attemptLogs.push({
              attempt: attemptName,
              stage: "redeem",
              status: redeemRes.status,
              detail,
            });
            return NextResponse.json({
              ok: false,
              error: "Wymiana na token dostępu nie powiodła się.",
              detail,
            });
          }

          const redeemData = JSON.parse(redeemText) as {
            accessToken?: { token?: string; validUntil?: string };
            refreshToken?: { token?: string; validUntil?: string };
          };
          const accessToken = redeemData.accessToken?.token;
          const refreshToken = redeemData.refreshToken?.token;
          if (!accessToken) {
            return NextResponse.json({
              ok: false,
              error: "Brak accessToken w odpowiedzi.",
              detail: redeemText.slice(0, 300),
            });
          }

          return NextResponse.json({
            ok: true,
            accessToken,
            refreshToken: refreshToken ?? undefined,
            accessTokenValidUntil: redeemData.accessToken?.validUntil,
          });
        }
      }
    }

    const attemptsSummary = attemptLogs
      .map((a) => `${a.attempt}:${a.stage}:${a.status ?? "?"}:${a.detail}`)
      .join(" | ")
      .slice(0, 1800);
    return NextResponse.json({
      ok: false,
      error: "Token KSeF odrzucony (450). Sprawdź: token aktualny i nieużyty, NIP zgodny z tokenem, URL to to samo środowisko (produkcja/demo) co portal MCU.",
      detail: attemptsSummary || "Wszystkie warianty logowania zakończyły się niepowodzeniem.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      error: "Błąd połączenia z KSEF.",
      detail: msg.slice(0, 300),
    });
  }
}
