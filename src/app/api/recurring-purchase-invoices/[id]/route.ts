import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: {
    name?: string;
    dayOfMonth?: number;
    sellerName?: string;
    sellerNip?: string;
    expenseCategoryId?: string | null;
    sortOrder?: number;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Nazwa nie może być pusta" }, { status: 400 });
    update.name = name;
  }
  if (body.dayOfMonth != null) {
    const d = Number(body.dayOfMonth);
    if (d < 1 || d > 31) return NextResponse.json({ error: "Dzień miesiąca musi być 1–31" }, { status: 400 });
    update.dayOfMonth = d;
  }
  if (body.sellerName !== undefined) {
    const v = String(body.sellerName ?? "").trim();
    if (!v) return NextResponse.json({ error: "Nazwa dostawcy jest wymagana" }, { status: 400 });
    update.sellerName = v;
  }
  if (body.sellerNip !== undefined) {
    const v = String(body.sellerNip ?? "").trim();
    if (!v) return NextResponse.json({ error: "NIP dostawcy jest wymagany" }, { status: 400 });
    update.sellerNip = v;
  }
  if (body.expenseCategoryId !== undefined) update.expenseCategoryId = body.expenseCategoryId || null;
  if (typeof body.sortOrder === "number") update.sortOrder = body.sortOrder;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Brak pól do aktualizacji" }, { status: 400 });
  }

  const template = await prisma.recurringPurchaseInvoice.update({
    where: { id },
    data: update,
    include: { expenseCategory: true },
  });
  return NextResponse.json(template);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.recurringPurchaseInvoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
