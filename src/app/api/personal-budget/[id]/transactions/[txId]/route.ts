import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTransaction, deleteTransaction } from "@/modules/personal-budget/lib/transactions";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; txId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, txId } = await params;
  const budget = await prisma.personalBudget.findFirst({
    where: { id, userId: session.userId },
  });
  if (!budget) return NextResponse.json({ error: "Nie znaleziono budżetu" }, { status: 404 });

  const existing = await prisma.personalTransaction.findFirst({
    where: { id: txId, budgetId: id },
  });
  if (!existing) return NextResponse.json({ error: "Transakcja nie istnieje" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Parameters<typeof updateTransaction>[1] = {};
  if (body.accountId != null) data.accountId = body.accountId;
  if (body.date != null) data.date = new Date(body.date);
  if (body.payeeId !== undefined) data.payeeId = body.payeeId;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId;
  if (body.amount != null) data.amount = parseFloat(body.amount);
  if (body.memo !== undefined) data.memo = body.memo;
  if (body.cleared !== undefined) data.cleared = !!body.cleared;
  if (body.isPrivate !== undefined) data.isPrivate = !!body.isPrivate;

  const tx = await updateTransaction(txId, data);
  return NextResponse.json(tx);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; txId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, txId } = await params;
  const budget = await prisma.personalBudget.findFirst({
    where: { id, userId: session.userId },
  });
  if (!budget) return NextResponse.json({ error: "Nie znaleziono budżetu" }, { status: 404 });

  const existing = await prisma.personalTransaction.findFirst({
    where: { id: txId, budgetId: id },
  });
  if (!existing) return NextResponse.json({ error: "Transakcja nie istnieje" }, { status: 404 });

  await deleteTransaction(txId);
  return NextResponse.json({ ok: true });
}
