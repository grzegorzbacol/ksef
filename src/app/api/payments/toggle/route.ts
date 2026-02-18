import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const invoiceId = body.invoiceId as string;
  if (!invoiceId) {
    return NextResponse.json({ error: "Brak invoiceId" }, { status: 400 });
  }

  const existing = await prisma.payment.findUnique({ where: { invoiceId } });
  if (existing) {
    await prisma.payment.delete({ where: { id: existing.id } });
    return NextResponse.json({ paid: false, paidAt: null });
  }

  const paidAt = new Date();
  await prisma.payment.create({
    data: { invoiceId, paidAt },
  });
  return NextResponse.json({ paid: true, paidAt: paidAt.toISOString() });
}
