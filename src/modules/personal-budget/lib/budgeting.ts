/**
 * Logika budżetowania – To Be Budgeted, przydziały, cele
 */

import { prisma } from "@/lib/prisma";
import {
  addMonths,
  startOfMonth,
  endOfMonth,
  differenceInMonths,
  startOfDay,
} from "date-fns";
import type { CategoryWithActivity, MonthBudgetSummary } from "../types";

const TO_BE_BUDGETED_NAME = "Do przydzielenia";

/** Pobiera lub tworzy kategorię "Do przydzielenia" w budżecie */
export async function getOrCreateToBeBudgetedCategory(budgetId: string) {
  const group = await prisma.personalCategoryGroup.findFirst({
    where: { budgetId },
    orderBy: { sortOrder: "asc" },
  });
  if (!group) throw new Error("Brak grup kategorii w budżecie");

  let tbb = await prisma.personalCategory.findFirst({
    where: { groupId: group.id, isSystem: true },
  });
  if (!tbb) {
    tbb = await prisma.personalCategory.create({
      data: {
        groupId: group.id,
        name: TO_BE_BUDGETED_NAME,
        isSystem: true,
        sortOrder: -1,
      },
    });
  }
  return tbb;
}

/** Oblicza "To Be Budgeted" dla miesiąca: przychody - przydziały - wydatki bez kategorii */
export async function computeToBeBudgeted(
  budgetId: string,
  month: number,
  year: number
): Promise<number> {
  const [tbbCategory, allocations, transactions, onBudgetAccounts] = await Promise.all([
    getOrCreateToBeBudgetedCategory(budgetId),
    prisma.personalAllocation.findMany({
      where: { category: { group: { budgetId } } },
      include: { category: true },
    }),
    prisma.personalTransaction.findMany({
      where: {
        budgetId,
        date: {
          gte: startOfMonth(new Date(year, month - 1)),
          lte: endOfMonth(new Date(year, month - 1)),
        },
      },
      include: { account: true },
    }),
    prisma.personalAccount.findMany({
      where: { budgetId, isOnBudget: true },
    }),
  ]);

  const accountIds = new Set(onBudgetAccounts.map((a) => a.id));
  const monthAllocations = allocations.filter(
    (a) => a.month === month && a.year === year
  );
  const totalAllocated = monthAllocations.reduce((s, a) => s + a.amount, 0);

  // Przychody w tym miesiącu (dodatnie transakcje na kontach ON_BUDGET)
  const incomeThisMonth = transactions
    .filter((t) => accountIds.has(t.accountId) && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  // Salda początkowego dnia miesiąca (przeniesione z poprzednich miesięcy)
  const monthStart = startOfMonth(new Date(year, month - 1));
  const prevMonth = addMonths(monthStart, -1);
  const prevAllocations = allocations.filter(
    (a) => a.month === prevMonth.getMonth() + 1 && a.year === prevMonth.getFullYear()
  );
  const prevTransactions = await prisma.personalTransaction.findMany({
    where: {
      budgetId,
      date: { lt: monthStart },
    },
    include: { account: true },
  });

  let startingBalance = 0;
  for (const acc of onBudgetAccounts) {
    const accTx = prevTransactions.filter((t) => t.accountId === acc.id);
    startingBalance += acc.balance; // używamy cache balance – w praktyce powinniśmy przeliczać
  }
  // fallback: sum transakcji przed początkiem miesiąca
  if (startingBalance === 0) {
    startingBalance = prevTransactions
      .filter((t) => accountIds.has(t.accountId))
      .reduce((s, t) => s + t.amount, 0);
  }

  const tbbAlloc = monthAllocations.find((a) => a.categoryId === tbbCategory.id);
  const tbbAllocated = tbbAlloc?.amount ?? 0;
  const toBeBudgeted = incomeThisMonth + startingBalance - totalAllocated + tbbAllocated;
  return toBeBudgeted;
}

/** Pobiera podsumowanie budżetu na miesiąc */
export async function getMonthBudgetSummary(
  budgetId: string,
  month: number,
  year: number
): Promise<MonthBudgetSummary> {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));

  const [groups, allocations, transactions] = await Promise.all([
    prisma.personalCategoryGroup.findMany({
      where: { budgetId },
      orderBy: { sortOrder: "asc" },
      include: {
        categories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      },
    }),
    prisma.personalAllocation.findMany({
      where: { category: { group: { budgetId } } },
      include: { category: true },
    }),
    prisma.personalTransaction.findMany({
      where: {
        budgetId,
        date: { gte: monthStart, lte: monthEnd },
      },
    }),
  ]);

  const categories: CategoryWithActivity[] = [];
  const monthAllocMap = new Map<string, number>();
  const monthTxMap = new Map<string, number>();

  for (const a of allocations) {
    if (a.month === month && a.year === year) {
      monthAllocMap.set(a.categoryId, (monthAllocMap.get(a.categoryId) ?? 0) + a.amount);
    }
  }
  for (const t of transactions) {
    if (t.categoryId) {
      monthTxMap.set(t.categoryId, (monthTxMap.get(t.categoryId) ?? 0) + t.amount);
    }
  }

  let totalAllocated = 0;
  let totalActivity = 0;
  const overspentCategories: string[] = [];

  for (const grp of groups) {
    for (const cat of grp.categories) {
      const allocated = monthAllocMap.get(cat.id) ?? 0;
      const activity = monthTxMap.get(cat.id) ?? 0;
      const available = allocated + activity;
      const overspent = available < 0;

      totalAllocated += allocated;
      totalActivity += activity;
      if (overspent) overspentCategories.push(cat.name);

      categories.push({
        id: cat.id,
        name: cat.name,
        groupId: grp.id,
        groupName: grp.name,
        isSystem: cat.isSystem,
        isPrivateExpenses: grp.isPrivateExpenses,
        targetType: cat.targetType as CategoryWithActivity["targetType"],
        targetAmount: cat.targetAmount,
        targetDate: cat.targetDate,
        allocated,
        activity,
        available,
        overspent,
      });
    }
  }

  const tbb = await computeToBeBudgeted(budgetId, month, year);

  return {
    month,
    year,
    toBeBudgeted: tbb,
    totalAllocated,
    totalActivity,
    overspentCategories,
    categories,
  };
}

/** Ustawia przydział dla kategorii w danym miesiącu */
export async function setAllocation(
  budgetId: string,
  categoryId: string,
  month: number,
  year: number,
  amount: number
) {
  const cat = await prisma.personalCategory.findFirst({
    where: { id: categoryId, group: { budgetId } },
  });
  if (!cat) throw new Error("Kategoria nie istnieje");

  await prisma.personalAllocation.upsert({
    where: {
      categoryId_month_year: { categoryId, month, year },
    },
    create: { categoryId, month, year, amount },
    update: { amount },
  });
}
