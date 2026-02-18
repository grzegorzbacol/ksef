import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCompanySettings, setCompanySettings } from "@/lib/settings";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await getCompanySettings();
  return NextResponse.json(company);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  await setCompanySettings({
    name: String(body.name ?? "").trim(),
    nip: String(body.nip ?? "").trim().replace(/\s/g, ""),
    address: String(body.address ?? "").trim(),
    postalCode: String(body.postalCode ?? "").trim(),
    city: String(body.city ?? "").trim(),
  });
  return NextResponse.json({ ok: true });
}
