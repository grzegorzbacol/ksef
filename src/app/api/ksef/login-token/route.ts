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
    let certB64Raw = certItem?.certificate ?? (keyList as CertEntry[])[0]?.certificate;
    if (!certB64Raw) {
      return NextResponse.json({
        ok: false,
        error: "Brak certyfikatu KsefTokenEncryption w odpowiedzi KSEF.",
        detail: `Otrzymano ${keyList.length} element(ów). Pierwszy: ${JSON.stringify((keyList as CertEntry[])[0]).slice(0, 200)}`,
      });
    }
    const certB64 = certB64Raw.replace(/\s/g, "");

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

    const tokenTrimmed = token.trim();
    if (!tokenTrimmed) {
      return NextResponse.json({ ok: false, error: "Wpisz token z MCU." });
    }
    // Dwa warianty: pełny token (jak z API) lub tylko ostatni segment (secret) – portal MCU zwraca ref|nip-XXX|secret
    const lastSegment =
      tokenTrimmed.includes("|") ?
        (tokenTrimmed.split("|").map((s) => s.trim()).pop() ?? "").trim() || tokenTrimmed
      : tokenTrimmed;

    const certBuf = Buffer.from(certB64, "base64");
    const encryptPayload = (payload: string): string => {
      const payloadBuf = Buffer.from(payload, "utf8");
      let encryptedBuf: Buffer;
      let lastErr: Error | null = null;
      try {
        const x509 = new X509Certificate(certBuf);
        encryptedBuf = publicEncrypt(
          { key: x509.publicKey, padding: 1, oaepHash: "sha256" },
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
          throw new Error(lastErr?.message ?? (e2 instanceof Error ? e2.message : String(e2)));
        }
      }
      return encryptedBuf.toString("base64");
    };

    // 3.–4b. Dwie próby: najpierw pełny token, przy 450 "Invalid token encryption" (z POST lub z pollingu) – ponów z ostatnim segmentem (secret) i nowym challenge
    const tokenVariants: { label: string; value: string }[] =
      lastSegment !== tokenTrimmed
        ? [
            { label: "pełny token", value: tokenTrimmed },
            { label: "ostatni segment (secret)", value: lastSegment },
          ]
        : [{ label: "token", value: tokenTrimmed }];

    let authToken: string | undefined;
    let referenceNumber: string | undefined;
    let lastPollError: { code: number; details: string } | null = null;
    let pollSucceeded = false;

    for (let variantIndex = 0; variantIndex < tokenVariants.length; variantIndex++) {
      const tokenToEncrypt = tokenVariants[variantIndex].value;
      let currentChallenge = challenge;
      let currentTimestampMs = timestampMs;
      if (variantIndex > 0) {
        const chRes = await fetch(`${base}/auth/challenge`, { method: "POST", headers: { "Content-Type": "application/json" } });
        if (!chRes.ok) break;
        const chData = (await chRes.json()) as { challenge?: string; timestamp?: string; timestampMs?: number };
        const nextChallenge = chData.challenge;
        const nextTs = chData.timestampMs ?? (chData.timestamp ? new Date(chData.timestamp).getTime() : 0);
        if (!nextChallenge || nextTs == null) break;
        currentChallenge = nextChallenge;
        currentTimestampMs = nextTs;
      }

      const payload = `${tokenToEncrypt}|${currentTimestampMs}`;
      let encryptedToken: string;
      try {
        encryptedToken = encryptPayload(payload);
      } catch (e) {
        return NextResponse.json({
          ok: false,
          error: "Szyfrowanie tokenu nie powiodło się (klucz publiczny KSEF).",
          detail: e instanceof Error ? e.message : String(e),
        });
      }

      const ksefTokenRes = await fetch(`${base}/auth/ksef-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challenge: currentChallenge,
          contextIdentifier: { type: "Nip", value: nip },
          encryptedToken,
        }),
      });
      const ksefTokenText = await ksefTokenRes.text();
      if (!ksefTokenRes.ok) {
        const detailLower = ksefTokenText.toLowerCase();
        const isInvalidEncryption =
          (ksefTokenRes.status === 450 || ksefTokenRes.status === 401) &&
          detailLower.includes("invalid") &&
          detailLower.includes("encryption");
        if (isInvalidEncryption && variantIndex < tokenVariants.length - 1) continue;
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
      authToken = ksefTokenData.authenticationToken?.token;
      referenceNumber = ksefTokenData.referenceNumber;
      if (!authToken) {
        return NextResponse.json({
          ok: false,
          error: "Odpowiedź KSEF nie zawiera authenticationToken.",
          detail: ksefTokenText?.slice(0, 200),
        });
      }

      lastPollError = null;
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
          const code = statusData.status?.code ?? 0;
          const details = statusData.status?.details?.join("; ") ?? statusData.status?.description ?? "";
          if (code === 200) {
            pollSucceeded = true;
            break;
          }
          if (code === 450 || code === 415 || code === 425 || code === 460 || code >= 400) {
            lastPollError = { code, details };
            const isInvalidEncryption =
              code === 450 && details.toLowerCase().includes("invalid") && details.toLowerCase().includes("encryption");
            if (isInvalidEncryption && variantIndex < tokenVariants.length - 1) break; // wyjdz z pętli pollingu, spróbuj drugi wariant
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
      if (pollSucceeded) break;
    }

    if (!authToken || !pollSucceeded) {
      const msg = lastPollError
        ? `Uwierzytelnianie nie powiodło się (${lastPollError.code}). ${lastPollError.details}`
        : "Brak authenticationToken.";
      return NextResponse.json({
        ok: false,
        error: "Token KSeF odrzucony (450). Sprawdź: czy token z MCU jest aktualny i nie użyty wcześniej, czy NIP jest zgodny z kontekstem tokenu, czy URL to to samo środowisko (produkcja/demo) co portal, z którego skopiowano token.",
        detail: lastPollError?.details ?? msg,
      });
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
