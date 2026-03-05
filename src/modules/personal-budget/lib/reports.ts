/**
 * Raporty – wydatki, wartość netto, trendy
 */

import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

export interface SpendingByCategoryRow {
  categoryId: string;
  categoryName: string;
  groupName: string;
  amount: number; // wartość bezwzględna wydatków
  percent: number;
}

export async function getSpendingByCategory(
  budgetId: string,
  month: number,
  year: number,
  options?: { includePrivateOnly?: boolean }
) {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));

  const transactions = await prisma.personalTransaction.findMany({
    where: {
      budgetId,
      date: { gte: start, lte: end },
      amount: { lt: 0 },
      ...(options?.includePrivateOnly === true && { isPrivate: true }),
    },
    include: { category: { include: { group: true } } },
  });

  const byCategory = new Map<string, { name: string; groupName: string; sum: number }>();
  let total = 0;

  for (const t of transactions) {
    if (!t.categoryId) continue;
    const key = t.categoryId;
    const cat = t.category!;
    const prev = byCategory.get(key);
    const abs = Math.abs(t.amount);
    total += abs;
    byCategory.set(key, {
      name: cat.name,
      groupName: cat.group.name,
      sum: (prev?.sum ?? 0) + abs,
    });
  }

  const rows: SpendingByCategoryRow[] = Array.from(byCategory.entries()).map(([categoryId, v]) => ({
      categoryId,
      categoryName: v.name,
      groupName: v.groupName,
      amount: v.sum,
      percent: total > 0 ? (v.sum / total) * 100 : 0,
    }));
  return rows.sort((a, b) => b.amount - a.amount);
}

export interface NetWorthSnapshot {
  date: string;
  onBudget: number;
  offBudget: number;
  total: number;
}

export async function getNetWorth(
  budgetId: string,
  asOfDate?: Date
): Promise<{ onBudget: number; offBudget: number; total: number }> {
  const accounts = await prisma.personalAccount.findMany({
    where: { budgetId },
  });
  let onBudget = 0;
  let offBudget = 0;
  for (const a of accounts) {
    if (a.isOnBudget) onBudget += a.balance;
    else offBudget += a.balance;
  }
  return {
    onBudget,
    offBudget,
    total: onBudget + offBudget,
  };
}

export interface IncomeVsExpensesRow {
  month: number;
  year: number;
  income: number;
  expenses: number;
  balance: number;
}

export async function getIncomeVsExpenses(
  budgetId: string,
  monthsBack: number = 6
): Promise<IncomeVsExpensesRow[]> {
  const rows: IncomeVsExpensesRow[] = [];
  const now = new Date();

  for (let i = 0; i < monthsBack; i++) {
    const d = subMonths(now, i);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const start = startOfMonth(d);
    const end = endOfMonth(d);

    const tx = await prisma.personalTransaction.findMany({
      where: { budgetId, date: { gte: start, lte: end } },
    });

    const income = tx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expenses = Math.abs(
      tx.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)
    );
    rows.push({ month, year, income, expenses, balance: income - expenses });
  }

  return rows.reverse();
}
