import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTransaction } from "@/modules/personal-budget/lib/transactions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const budget = await prisma.personalBudget.findFirst({
    where: { id, userId: session.userId },
  });
  if (!budget) return NextResponse.json({ error: "Nie znaleziono budżetu" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const accountId = searchParams.get("accountId");
  const isPrivate = searchParams.get("isPrivate"); // "true" = tylko wydatki prywatne

  const where: Record<string, unknown> = { budgetId: id };
  if (accountId) where.accountId = accountId;
  if (isPrivate === "true") where.isPrivate = true;

  if (month && year) {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (m >= 1 && m <= 12 && y >= 2020) {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }
  }

  const transactions = await prisma.personalTransaction.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      account: true,
      category: { include: { group: true } },
      payee: true,
    },
  });
  return NextResponse.json(transactions);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const budget = await prisma.personalBudget.findFirst({
    where: { id, userId: session.userId },
  });
  if (!budget) return NextResponse.json({ error: "Nie znaleziono budżetu" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const accountId = body.accountId;
  const date = body.date ? new Date(body.date) : new Date();
  const amount = parseFloat(body.amount);
  if (!accountId || typeof amount !== "number" || isNaN(amount)) {
    return NextResponse.json({ error: "Wymagane: accountId, amount" }, { status: 400 });
  }

  const tx = await createTransaction({
    budgetId: id,
    accountId,
    date,
    payeeId: body.payeeId ?? null,
    categoryId: body.categoryId ?? null,
    amount,
    memo: body.memo ?? null,
    cleared: body.cleared ?? false,
    isPrivate: body.isPrivate ?? false,
  });
  return NextResponse.json(tx);
}
