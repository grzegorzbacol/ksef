import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

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
      error: "Wpisz token w polu powyżej, aby sprawdzić połączenie.",
    });
  }
  if (/[^\x00-\x7F]/.test(token)) {
    return NextResponse.json({
      ok: false,
      error: "Token zawiera niedozwolone znaki (tylko ASCII).",
    });
  }

  const testUrl = `${apiUrl}/v2/auth/sessions?pageSize=1`;
  try {
    const res = await fetch(testUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let detail: string | undefined;
    try {
      const json = JSON.parse(text);
      detail = json.message ?? json.details ?? json.exceptionDescription ?? text?.slice(0, 300);
    } catch {
      detail = text?.slice(0, 300);
    }
    if (res.ok) {
      return NextResponse.json({ ok: true, status: res.status, message: "Połączenie z KSEF poprawne." });
    }
    const errMsg =
      res.status === 401
        ? "KSEF odrzucił token (401). Jeśli w polu Token masz token z MCU (tekst z „|”, np. ref|nip-XXX|secret), najpierw kliknij „Zaloguj tokenem KSeF” – do połączenia potrzebny jest token dostępu (JWT), nie token z MCU."
        : `KSEF zwrócił ${res.status}.`;
    return NextResponse.json({
      ok: false,
      status: res.status,
      error: errMsg,
      detail: detail || undefined,
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
