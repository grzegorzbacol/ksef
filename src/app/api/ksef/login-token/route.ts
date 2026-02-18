import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { X509Certificate, createPublicKey, publicEncrypt } from "crypto";

/**
 * Logowanie tokenem KSeF z MCU – zgodnie z oficjalną specyfikacją API KSEF 2.0.
 *
 * Specyfikacja:
 * - Payload do szyfrowania: ciąg "token|timestamp" (timestamp w milisekundach Unix z challenge).
 * - Dla tokena z portalu MCU (format: ref|nip-XXX|secret) do szyfrowania używamy TYLKO ostatniego segmentu (secret).
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
    const certB64 = certRow?.certificate?.replace(/\s/g, "");
    if (!certB64) {
      return NextResponse.json({
        ok: false,
        error: "Brak certyfikatu KsefTokenEncryption w odpowiedzi KSEF.",
      });
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

    // —— 3. Wyciągnij secret (dla MCU: ref|nip-XXX|secret → tylko ostatni segment) ——
    const segments = rawToken.split("|").map((s) => s.trim());
    const secret = segments.length >= 3 ? segments[segments.length - 1]! : rawToken;
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Nie udało się odczytać tokenu (oczekiwany format: ref|nip-XXX|secret)." });
    }

    // —— 4. Zaszyfruj payload: "secret|timestampMs" (RSA-OAEP SHA-256) ——
    const payload = `${secret}|${timestampMs}`;
    const payloadBytes = Buffer.from(payload, "utf8");
    const certDer = Buffer.from(certB64, "base64");
    let publicKey: ReturnType<typeof createPublicKey>;
    try {
      const x509 = new X509Certificate(certDer);
      publicKey = x509.publicKey as ReturnType<typeof createPublicKey>;
    } catch {
      publicKey = createPublicKey({ key: certDer, format: "der", type: "spki" });
    }
    const encrypted = publicEncrypt(
      { key: publicKey, padding: 1, oaepHash: "sha256" },
      payloadBytes
    );
    const encryptedTokenB64 = encrypted.toString("base64");

    // —— 5. POST /auth/ksef-token ——
    const initRes = await fetch(`${base}/auth/ksef-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challenge,
        contextIdentifier: { type: "Nip", value: nip },
        encryptedToken: encryptedTokenB64,
      }),
    });
    const initText = await initRes.text();
    if (!initRes.ok) {
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
    const authToken = initData.authenticationToken?.token;
    const referenceNumber = initData.referenceNumber;
    if (!authToken) {
      return NextResponse.json({
        ok: false,
        error: "Odpowiedź KSEF nie zawiera authenticationToken.",
        detail: initText.slice(0, 300),
      });
    }

    // —— 6. Polling statusu (GET /auth/{referenceNumber}) do 200 lub błąd ——
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
        break;
      }
      if (code === 450 || code === 415 || code === 425 || code === 460 || code >= 400) {
        return NextResponse.json({
          ok: false,
          error: code === 450
            ? "Token KSeF odrzucony (450). Sprawdź: token aktualny i nieużyty, NIP zgodny z tokenem, URL to to samo środowisko (produkcja/demo) co portal MCU."
            : `Uwierzytelnianie nie powiodło się (${code}).`,
          detail: details || JSON.stringify(statusJson).slice(0, 300),
        });
      }
    }
    if (!pollOk) {
      return NextResponse.json({
        ok: false,
        error: "Przekroczono czas oczekiwania na potwierdzenie uwierzytelnienia.",
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
