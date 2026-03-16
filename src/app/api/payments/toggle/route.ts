import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDateInClosedPeriod } from "@/lib/closed-periods";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const invoiceId = body.invoiceId as string;
  if (!invoiceId) {
    return NextResponse.json({ error: "Brak invoiceId" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { issueDate: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Nie znaleziono faktury" }, { status: 404 });
  }
  if (await isDateInClosedPeriod(invoice.issueDate)) {
    const m = invoice.issueDate.getMonth() + 1;
    const y = invoice.issueDate.getFullYear();
    return NextResponse.json(
      { error: `Miesiąc ${String(m).padStart(2, "0")}.${y} jest zamknięty. Nie można zmieniać statusu płatności dla faktur z tego miesiąca.` },
      { status: 400 },
    );
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
