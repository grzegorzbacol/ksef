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
  const pitRate = body.pitRate != null ? Number(body.pitRate) : 0.12;
  const healthRate = body.healthRate != null ? Number(body.healthRate) : 0.09;
  const isVatPayer = body.isVatPayer !== false && body.isVatPayer !== "false";
  await setCompanySettings({
    name: String(body.name ?? "").trim(),
    nip: String(body.nip ?? "").trim().replace(/\s/g, ""),
    address: String(body.address ?? "").trim(),
    postalCode: String(body.postalCode ?? "").trim(),
    city: String(body.city ?? "").trim(),
    pitRate: pitRate === 0.32 ? 0.32 : 0.12,
    healthRate: Number.isNaN(healthRate) ? 0.09 : Math.max(0, Math.min(1, healthRate)),
    isVatPayer,
  });
  return NextResponse.json({ ok: true });
}
