import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Zwraca zestawienie budżetu dla danego miesiąca: kategorie, planowane kwoty, rzeczywiste (transakcje).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (!month || !year) {
    return NextResponse.json({ error: "Parametry month i year są wymagane" }, { status: 400 });
  }

  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (isNaN(m) || m < 1 || m > 12 || isNaN(y)) {
    return NextResponse.json({ error: "Nieprawidłowy miesiąc lub rok" }, { status: 400 });
  }

  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);

  const [categories, allocations, transactions] = await Promise.all([
    prisma.budgetCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.budgetAllocation.findMany({
      where: { month: m, year: y },
      include: { category: true },
    }),
    prisma.budgetTransaction.findMany({
      where: { date: { gte: start, lte: end } },
      include: { category: true },
    }),
  ]);

  const allocationMap = new Map(allocations.map((a) => [a.categoryId, a.plannedAmount]));
  const actualByCategory = new Map<string, number>();
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const tx of transactions) {
    const sum = actualByCategory.get(tx.categoryId) ?? 0;
    actualByCategory.set(tx.categoryId, sum + tx.amount);
    if (tx.amount > 0) totalIncome += tx.amount;
    else totalExpenses += Math.abs(tx.amount);
  }

  const totalPlanned = allocations.reduce((s, a) => s + a.plannedAmount, 0);
  const categoriesSummary = categories.map((cat) => {
    const planned = allocationMap.get(cat.id) ?? 0;
    const actual = actualByCategory.get(cat.id) ?? 0;
    const spent = actual < 0 ? Math.abs(actual) : 0;
    const utilization = planned > 0 ? Math.min(100, (spent / planned) * 100) : 0;
    const remaining = planned - spent;

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      sortOrder: cat.sortOrder,
      plannedAmount: planned,
      actualAmount: actual,
      remaining,
      utilizationPercent: utilization,
    };
  });

  return NextResponse.json({
    month: m,
    year: y,
    totalPlanned,
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    plannedExpenses: totalPlanned,
    remainingBudget: totalPlanned - totalExpenses,
    categories: categoriesSummary,
    transactions,
  });
}
