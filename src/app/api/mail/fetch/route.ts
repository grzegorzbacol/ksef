import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchInvoicesFromMail } from "@/lib/mail-fetch";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await fetchInvoicesFromMail(prisma);
  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error || "Błąd pobierania z maila" }, { status: 200 });
  }
  return NextResponse.json({ ok: true, imported: result.imported ?? 0 });
}
