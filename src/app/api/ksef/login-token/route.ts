import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { X509Certificate, createPublicKey, publicEncrypt } from "crypto";

/**
 * Pełny flow logowania tokenem KSeF z MCU:
 * 1. Pobranie challenge i klucza publicznego KSEF
 * 2. Szyfrowanie token|timestamp RSA-OAEP SHA-256
 * 3. POST /auth/ksef-token → authenticationToken
 * 4. POST /auth/token/redeem → accessToken + refreshToken
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let apiUrl = (body.apiUrl as string)?.trim() || "https://api.ksef.mf.gov.pl";
  const token = (body.token as string)?.trim() || "";
  const nip = (body.nip as string)?.trim()?.replace(/\D/g, "") || "";

  apiUrl = apiUrl.replace(/\/$/, "");
  const base = `${apiUrl}/v2`;

  if (!token) {
    return NextResponse.json({ ok: false, error: "Wpisz token z MCU (Moduł certyfikatów i uprawnień)." });
  }
  if (/[^\x00-\x7F]/.test(token)) {
    return NextResponse.json({ ok: false, error: "Token może zawierać tylko znaki ASCII." });
  }
  if (nip.length !== 10) {
    return NextResponse.json({ ok: false, error: "Podaj prawidłowy NIP (10 cyfr) – kontekst uwierzytelnienia." });
  }

  try {
    // 1. Pobierz klucz publiczny do szyfrowania tokenu KSeF
    const keyRes = await fetch(`${base}/security/public-key-certificates`);
    if (!keyRes.ok) {
      const t = await keyRes.text();
      return NextResponse.json({
        ok: false,
        error: "Nie udało się pobrać klucza publicznego KSEF.",
        detail: t?.slice(0, 200),
      });
    }
    const keyRaw = await keyRes.json();
    const keyList = Array.isArray(keyRaw) ? keyRaw : keyRaw?.items ?? keyRaw?.certificates ?? (keyRaw ? [keyRaw] : []);
    type CertEntry = { certificate?: string; usage?: string | string[] };
    const certItem = (keyList as CertEntry[]).find((c) => {
      const u = c.usage;
      if (Array.isArray(u)) return u.includes("KsefTokenEncryption");
      return u === "KsefTokenEncryption";
    });
    const certB64 = certItem?.certificate ?? (keyList as CertEntry[])[0]?.certificate;
    if (!certB64) {
      return NextResponse.json({
        ok: false,
        error: "Brak certyfikatu KsefTokenEncryption w odpowiedzi KSEF.",
        detail: `Otrzymano ${keyList.length} element(ów). Pierwszy: ${JSON.stringify((keyList as CertEntry[])[0]).slice(0, 200)}`,
      });
    }

    // 2. Pobierz challenge
    const challengeRes = await fetch(`${base}/auth/challenge`, { method: "POST", headers: { "Content-Type": "application/json" } });
    if (!challengeRes.ok) {
      const t = await challengeRes.text();
      return NextResponse.json({ ok: false, error: "Nie udało się pobrać challenge.", detail: t?.slice(0, 200) });
    }
    const challengeData = (await challengeRes.json()) as {
      challenge?: string;
      timestamp?: string;
      timestampMs?: number;
    };
    const challenge = challengeData.challenge;
    let timestampMs = challengeData.timestampMs;
    if (timestampMs == null && challengeData.timestamp) {
      timestampMs = new Date(challengeData.timestamp).getTime();
    }
    if (!challenge || timestampMs == null) {
      return NextResponse.json({ ok: false, error: "Odpowiedź challenge nie zawiera challenge lub timestamp." });
    }

    // Token z portalu MCU bywa w formacie "referencja | nip-XXX | secret" – do szyfrowania używamy tylko ostatniego segmentu (secret)
    const tokenToEncrypt = token.includes(" | ") ? token.split(" | ").pop()?.trim() ?? token : token;
    if (!tokenToEncrypt) {
      return NextResponse.json({ ok: false, error: "Nie udało się odczytać tokenu (format: referencja | nip-XXX | secret)." });
    }

    // 3. Zaszyfruj token|timestampMs (RSA-OAEP SHA-256) kluczem publicznym z certyfikatu KSEF
    const payload = `${tokenToEncrypt}|${timestampMs}`;
    const payloadBuf = Buffer.from(payload, "utf8");
    const certBuf = Buffer.from(certB64, "base64");
    let encryptedBuf: Buffer;
    let lastErr: Error | null = null;
    try {
      const x509 = new X509Certificate(certBuf);
      const publicKey = x509.publicKey;
      encryptedBuf = publicEncrypt(
        { key: publicKey, padding: 1, oaepHash: "sha256" },
        payloadBuf
      );
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      try {
        const publicKey = createPublicKey({ key: certBuf, format: "der", type: "spki" });
        encryptedBuf = publicEncrypt(
          { key: publicKey, padding: 1, oaepHash: "sha256" },
          payloadBuf
        );
      } catch (e2) {
        return NextResponse.json({
          ok: false,
          error: "Szyfrowanie tokenu nie powiodło się (klucz publiczny KSEF).",
          detail: lastErr?.message ?? (e2 instanceof Error ? e2.message : String(e2)),
        });
      }
    }
    const encryptedToken = encryptedBuf.toString("base64");

    // 4. Uwierzytelnienie tokenem KSeF
    const ksefTokenRes = await fetch(`${base}/auth/ksef-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge,
        contextIdentifier: { type: "Nip", value: nip },
        encryptedToken,
      }),
    });
    const ksefTokenText = await ksefTokenRes.text();
    if (!ksefTokenRes.ok) {
      let detail: string | undefined;
      try {
        const j = JSON.parse(ksefTokenText);
        detail = j.details ?? j.message ?? j.exceptionDescription ?? ksefTokenText?.slice(0, 300);
      } catch {
        detail = ksefTokenText?.slice(0, 300);
      }
      return NextResponse.json({
        ok: false,
        error: ksefTokenRes.status === 401 ? "KSEF odrzucił token (401)." : `KSEF zwrócił ${ksefTokenRes.status}.`,
        detail,
      });
    }
    const ksefTokenData = JSON.parse(ksefTokenText) as {
      authenticationToken?: { token?: string };
      referenceNumber?: string;
    };
    const authToken = ksefTokenData.authenticationToken?.token;
    const referenceNumber = ksefTokenData.referenceNumber;
    if (!authToken) {
      return NextResponse.json({
        ok: false,
        error: "Odpowiedź KSEF nie zawiera authenticationToken.",
        detail: ksefTokenText?.slice(0, 200),
      });
    }

    // 4b. Odpytywanie statusu uwierzytelniania (proces asynchroniczny) – czekaj na 200 lub błąd 4xx
    if (referenceNumber) {
      const maxAttempts = 20;
      const delayMs = 1500;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((r) => setTimeout(r, attempt === 0 ? 500 : delayMs));
        const statusRes = await fetch(`${base}/auth/${encodeURIComponent(referenceNumber)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!statusRes.ok) break;
        const statusData = (await statusRes.json()) as { status?: { code?: number; description?: string; details?: string[] } };
        const code = statusData.status?.code;
        if (code === 200) break;
        if (code === 450 || code === 415 || code === 425 || code === 460 || (code && code >= 400)) {
          const details = statusData.status?.details?.join("; ") ?? statusData.status?.description ?? "";
          return NextResponse.json({
            ok: false,
            error: code === 450
              ? "Token KSeF odrzucony (450). Sprawdź: czy token z MCU jest aktualny i nie użyty wcześniej, czy NIP jest zgodny z kontekstem tokenu, czy URL to to samo środowisko (produkcja/demo) co portal, z którego skopiowano token."
              : `Uwierzytelnianie nie powiodło się (${code}).`,
            detail: details || JSON.stringify(statusData).slice(0, 200),
          });
        }
      }
    }

    // 5. Wymiana na access token
    const redeemRes = await fetch(`${base}/auth/token/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    });
    const redeemText = await redeemRes.text();
    if (!redeemRes.ok) {
      let detail: string | undefined;
      let hint = "";
      try {
        const j = JSON.parse(redeemText) as { exception?: { exceptionDetailList?: Array<{ exceptionCode?: number; details?: string[] }> } };
        const first = j.exception?.exceptionDetailList?.[0];
        detail = first?.details?.join("; ") ?? redeemText?.slice(0, 300);
        if (first?.exceptionCode === 21301 && detail?.includes("450")) {
          hint =
            " Status 450 = błędny token (nieprawidłowy, wygasły, unieważniony lub zły NIP/środowisko). Wygeneruj nowy token w MCU, upewnij się, że NIP i URL (produkcja/demo) są poprawne.";
        }
      } catch {
        detail = redeemText?.slice(0, 300);
      }
      return NextResponse.json({
        ok: false,
        error: "Wymiana na token dostępu nie powiodła się." + hint,
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
      return NextResponse.json({ ok: false, error: "Brak accessToken w odpowiedzi.", detail: redeemText?.slice(0, 200) });
    }

    return NextResponse.json({
      ok: true,
      accessToken,
      refreshToken: refreshToken ?? undefined,
      accessTokenValidUntil: redeemData.accessToken?.validUntil,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      error: "Błąd połączenia z KSEF.",
      detail: message.slice(0, 250),
    });
  }
}
