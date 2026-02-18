import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * Wymiana tokena z MCU (AuthenticationToken) na parę accessToken + refreshToken.
 * Token z portalu KSEF (MCU) często jest tokenem do jednorazowej wymiany – wywołanie
 * POST /v2/auth/token/redeem z Bearer <token> zwraca token dostępu do API.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  let apiUrl = (body.apiUrl as string)?.trim() || "https://api.ksef.mf.gov.pl";
  const token = (body.token as string)?.trim() || "";

  apiUrl = apiUrl.replace(/\/$/, "");
  if (!token) {
    return NextResponse.json({
      ok: false,
      error: "Wpisz token z MCU w polu powyżej.",
    });
  }
  if (/[^\x00-\x7F]/.test(token)) {
    return NextResponse.json({
      ok: false,
      error: "Token zawiera niedozwolone znaki (tylko ASCII).",
    });
  }

  const redeemUrl = `${apiUrl}/v2/auth/token/redeem`;
  try {
    const res = await fetch(redeemUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const text = await res.text();
    let detail: string | undefined;
    try {
      const json = JSON.parse(text);
      detail = json.message ?? json.details ?? json.exceptionDescription ?? text?.slice(0, 300);
    } catch {
      detail = text?.slice(0, 300);
    }
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        status: res.status,
        error: res.status === 401 ? "KSEF odrzucił token (401)." : `KSEF zwrócił ${res.status}.`,
        detail: detail || undefined,
      });
    }
    const data = JSON.parse(text) as {
      accessToken?: { token?: string; validUntil?: string };
      refreshToken?: { token?: string; validUntil?: string };
    };
    const accessToken = data.accessToken?.token;
    const refreshToken = data.refreshToken?.token;
    if (!accessToken) {
      return NextResponse.json({
        ok: false,
        error: "Odpowiedź KSEF nie zawiera tokenu dostępu.",
        detail: text?.slice(0, 200),
      });
    }
    return NextResponse.json({
      ok: true,
      accessToken,
      refreshToken: refreshToken || undefined,
      accessTokenValidUntil: data.accessToken?.validUntil,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ok: false,
      error: "Błąd połączenia z KSEF.",
      detail: message.slice(0, 200),
    });
  }
}
