import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { X509Certificate, createPublicKey, publicEncrypt } from "crypto";

/**
 * Logowanie tokenem KSeF z MCU – zgodnie z oficjalną specyfikacją API KSEF 2.0.
 *
 * Specyfikacja:
 * - Payload do szyfrowania: ciąg "token|timestamp" (timestamp w milisekundach Unix z challenge).
 * - Dla tokena z portalu MCU (format: ref|nip-XXX|secret) szyfrujemy CAŁY token (tak zwracany przez MCU).
 * - Algorytm: RSA-OAEP z SHA-256 (MGF1).
 * - Certyfikat: z GET /v2/security/public-key-certificates, usage = KsefTokenEncryption.
 */
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
    // —— 1. Pobierz certyfikat do szyfrowania (KsefTokenEncryption) ——
    const keyRes = await fetch(`${base}/security/public-key-certificates`);
    if (!keyRes.ok) {
      const t = await keyRes.text();
      return NextResponse.json({
        ok: false,
        error: "Nie udało się pobrać klucza publicznego KSEF.",
        detail: t.slice(0, 300),
      });
    }
    const keyJson = (await keyRes.json()) as unknown;
    const list = Array.isArray(keyJson) ? keyJson : (keyJson as { items?: unknown[] }).items ?? (keyJson as { certificates?: unknown[] }).certificates ?? [keyJson];
    type CertRow = { certificate?: string; usage?: string | string[] };
    const certRow = (list as CertRow[]).find(
      (c) => (Array.isArray(c.usage) ? c.usage.includes("KsefTokenEncryption") : c.usage === "KsefTokenEncryption")
    ) ?? (list as CertRow[])[0];
    let certB64 = certRow?.certificate?.replace(/\s/g, "");
    if (!certB64) {
      return NextResponse.json({
        ok: false,
        error: "Brak certyfikatu KsefTokenEncryption w odpowiedzi KSEF.",
      });
    }
    // Certyfikat może być w formacie PEM (-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----) lub raw Base64 (DER)
    if (certB64.includes("BEGIN")) {
      const match = /-----BEGINCERTIFICATE-----([A-Za-z0-9+/=]+)-----ENDCERTIFICATE-----/.exec(certB64);
      certB64 = match ? match[1]! : certB64.replace(/-----BEGINCERTIFICATE-----|-----ENDCERTIFICATE-----/g, "");
    }

    // —— 2. Pobierz challenge (challenge + timestamp w ms) ——
    const challengeRes = await fetch(`${base}/auth/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!challengeRes.ok) {
      const t = await challengeRes.text();
      return NextResponse.json({ ok: false, error: "Nie udało się pobrać challenge.", detail: t.slice(0, 300) });
    }
    const ch = (await challengeRes.json()) as { challenge?: string; timestamp?: string; timestampMs?: number | string };
    const challenge = ch.challenge;
    let timestampMs: number;
    if (ch.timestampMs != null) {
      timestampMs = typeof ch.timestampMs === "string" ? parseInt(ch.timestampMs, 10) : ch.timestampMs;
    } else if (ch.timestamp) {
      timestampMs = new Date(ch.timestamp).getTime();
    } else {
      return NextResponse.json({ ok: false, error: "Odpowiedź challenge nie zawiera timestamp." });
    }
    if (!challenge || Number.isNaN(timestampMs)) {
      return NextResponse.json({ ok: false, error: "Nieprawidłowa odpowiedź challenge." });
    }

    const certDer = Buffer.from(certB64, "base64");
    let publicKey: ReturnType<typeof createPublicKey>;
    try {
      const x509 = new X509Certificate(certDer);
      publicKey = x509.publicKey as ReturnType<typeof createPublicKey>;
    } catch {
      publicKey = createPublicKey({ key: certDer, format: "der", type: "spki" });
    }
    const doEncrypt = (payloadStr: string) =>
      publicEncrypt(
        { key: publicKey, padding: 1, oaepHash: "sha256" },
        Buffer.from(payloadStr, "utf8")
      ).toString("base64");

    const segments = rawToken.split("|").map((s) => s.trim());
    const secretOnly = segments.length >= 3 ? segments[segments.length - 1]! : rawToken;
    const variants: { tokenPart: string }[] = [{ tokenPart: rawToken }, { tokenPart: secretOnly }];
    if (secretOnly === rawToken) variants.pop();

    let authToken: string | undefined;
    let referenceNumber: string | undefined;
    let lastError: { detail: string } | null = null;
    let pollSucceeded = false;

    for (let attempt = 0; attempt < variants.length; attempt++) {
      let curChallenge = challenge;
      let curTimestampMs = timestampMs;
      if (attempt > 0) {
        const chRes = await fetch(`${base}/auth/challenge`, { method: "POST", headers: { "Content-Type": "application/json" } });
        if (!chRes.ok) break;
        const ch2 = (await chRes.json()) as { challenge?: string; timestamp?: string; timestampMs?: number | string };
        const nextCh = ch2.challenge;
        const nextTs = ch2.timestampMs != null
          ? (typeof ch2.timestampMs === "string" ? parseInt(ch2.timestampMs, 10) : ch2.timestampMs)
          : (ch2.timestamp ? new Date(ch2.timestamp).getTime() : 0);
        if (!nextCh || Number.isNaN(nextTs)) break;
        curChallenge = nextCh;
        curTimestampMs = nextTs;
      }

      const payload = `${variants[attempt]!.tokenPart}|${curTimestampMs}`;
      const encryptedTokenB64 = doEncrypt(payload);

      const initRes = await fetch(`${base}/auth/ksef-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge: curChallenge,
          contextIdentifier: { type: "Nip", value: nip },
          encryptedToken: encryptedTokenB64,
        }),
      });
      const initText = await initRes.text();
      if (!initRes.ok) {
        const detailLower = initText.toLowerCase();
        const is450Invalid = (initRes.status === 450 || initRes.status === 401) && detailLower.includes("invalid") && detailLower.includes("encryption");
        if (is450Invalid && attempt < variants.length - 1) {
          lastError = { detail: initText.slice(0, 400) };
          continue;
        }
        let detail: string | undefined;
        try {
          const j = JSON.parse(initText) as { message?: string; details?: string; exceptionDescription?: string };
          detail = j.details ?? j.message ?? j.exceptionDescription ?? initText.slice(0, 400);
        } catch {
          detail = initText.slice(0, 400);
        }
        return NextResponse.json({
          ok: false,
          error: initRes.status === 401 ? "KSEF odrzucił token (401)." : `KSEF zwrócił ${initRes.status}.`,
          detail,
        });
      }
      const initData = JSON.parse(initText) as { authenticationToken?: { token?: string }; referenceNumber?: string };
      authToken = initData.authenticationToken?.token;
      referenceNumber = initData.referenceNumber;
      if (!authToken) {
        return NextResponse.json({
          ok: false,
          error: "Odpowiedź KSEF nie zawiera authenticationToken.",
          detail: initText.slice(0, 300),
        });
      }

      lastError = null;
      const maxPollAttempts = 25;
      const pollDelayMs = 1500;
      let pollOk = false;
      for (let i = 0; i < maxPollAttempts; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 600 : pollDelayMs));
        const statusRes = await fetch(`${base}/auth/${encodeURIComponent(referenceNumber ?? "")}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!statusRes.ok) break;
        const statusJson = (await statusRes.json()) as { status?: { code?: number; description?: string; details?: string[] } };
        const code = statusJson.status?.code ?? 0;
        const details = statusJson.status?.details?.join("; ") ?? statusJson.status?.description ?? "";
        if (code === 200) {
          pollOk = true;
          pollSucceeded = true;
          break;
        }
        if (code === 450 || code === 415 || code === 425 || code === 460 || code >= 400) {
          lastError = { detail: details || JSON.stringify(statusJson).slice(0, 300) };
          const is450Invalid = code === 450 && details.toLowerCase().includes("invalid") && details.toLowerCase().includes("encryption");
          if (is450Invalid && attempt < variants.length - 1) break;
          return NextResponse.json({
            ok: false,
            error: code === 450
              ? "Token KSeF odrzucony (450). Sprawdź: token aktualny i nieużyty, NIP zgodny z tokenem, URL to to samo środowisko (produkcja/demo) co portal MCU."
              : `Uwierzytelnianie nie powiodło się (${code}).`,
            detail: lastError.detail,
          });
        }
      }
      if (pollOk) break;
    }

    if (!authToken || !referenceNumber || !pollSucceeded) {
      return NextResponse.json({
        ok: false,
        error: "Token KSeF odrzucony (450). Sprawdź: token aktualny i nieużyty, NIP zgodny z tokenem, URL to to samo środowisko (produkcja/demo) co portal MCU.",
        detail: lastError?.detail ?? "Uwierzytelnianie nie zakończyło się sukcesem.",
      });
    }

    // —— 7. Wymiana na access token (POST /auth/token/redeem) ——
    const redeemRes = await fetch(`${base}/auth/token/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    });
    const redeemText = await redeemRes.text();
    if (!redeemRes.ok) {
      let detail: string | undefined;
      try {
        const j = JSON.parse(redeemText) as { exception?: { exceptionDetailList?: Array<{ details?: string[] }> } };
        detail = j.exception?.exceptionDetailList?.[0]?.details?.join("; ") ?? redeemText.slice(0, 400);
      } catch {
        detail = redeemText.slice(0, 400);
      }
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
      return NextResponse.json({ ok: false, error: "Brak accessToken w odpowiedzi.", detail: redeemText.slice(0, 300) });
    }

    return NextResponse.json({
      ok: true,
      accessToken,
      refreshToken: refreshToken ?? undefined,
      accessTokenValidUntil: redeemData.accessToken?.validUntil,
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
