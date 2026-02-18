import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getKsefSettings, setSetting } from "@/lib/settings";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const s = await getKsefSettings();
  return NextResponse.json({
    apiUrl: s.apiUrl,
    token: s.token ? "********" : "",
    queryPath: s.queryPath,
    sendPath: s.sendPath,
    nip: s.nip,
    invoicePdfPath: s.invoicePdfPath,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const keys = ["ksef_api_url", "ksef_token", "ksef_query_path", "ksef_send_path", "ksef_nip", "ksef_invoice_pdf_path"];
  const map: Record<string, string> = {
    ksef_api_url: "apiUrl",
    ksef_token: "token",
    ksef_query_path: "queryPath",
    ksef_send_path: "sendPath",
    ksef_nip: "nip",
    ksef_invoice_pdf_path: "invoicePdfPath",
  };

  for (const key of keys) {
    const bodyKey = map[key];
    if (bodyKey && body[bodyKey] !== undefined) {
      const val = body[bodyKey];
      if (key === "ksef_token" && (val === "" || val === "********")) continue;
      await setSetting(key, String(val ?? ""));
    }
  }

  return NextResponse.json({ ok: true });
}
