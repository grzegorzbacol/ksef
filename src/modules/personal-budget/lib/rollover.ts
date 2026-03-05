/**
 * Logika rollover – niewykorzystane środki w kategoriach przechodzą do kolejnego miesiąca
 * W YNAB: Available = Activity + (allocated this month) + (available from last month)
 */

import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";

/** Oblicza dostępną kwotę kategorii w danym miesiącu z uwzględnieniem rolloveru */
export async function getCategoryAvailableWithRollover(
  budgetId: string,
  categoryId: string,
  month: number,
  year: number
): Promise<{ available: number; fromRollover: number }> {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));

  const [allocation, transactions, prevAvailable] = await Promise.all([
    prisma.personalAllocation.findUnique({
      where: {
        categoryId_month_year: { categoryId, month, year },
      },
    }),
    prisma.personalTransaction.findMany({
      where: {
        budgetId,
        categoryId,
        date: { gte: monthStart, lte: monthEnd },
      },
    }),
    getPreviousMonthAvailable(budgetId, categoryId, month, year),
  ]);

  const allocated = allocation?.amount ?? 0;
  const activity = transactions.reduce((s, t) => s + t.amount, 0);
  const fromRollover = prevAvailable;
  const available = fromRollover + allocated + activity;

  return { available, fromRollover };
}

/** Dostępna kwota z poprzedniego miesiąca (po activity i allocation) */
async function getPreviousMonthAvailable(
  budgetId: string,
  categoryId: string,
  month: number,
  year: number
): Promise<number> {
  const prev = addMonths(new Date(year, month - 1), -1);
  const prevMonth = prev.getMonth() + 1;
  const prevYear = prev.getFullYear();

  const [prevAlloc, prevTx] = await Promise.all([
    prisma.personalAllocation.findUnique({
      where: {
        categoryId_month_year: { categoryId, month: prevMonth, year: prevYear },
      },
    }),
    prisma.personalTransaction.findMany({
      where: {
        budgetId,
        categoryId,
        date: {
          gte: startOfMonth(prev),
          lte: endOfMonth(prev),
        },
      },
    }),
  ]);

  const prevAllocated = prevAlloc?.amount ?? 0;
  const prevActivity = prevTx.reduce((s, t) => s + t.amount, 0);
  const prevAvailable = prevAllocated + prevActivity;

  if (prevAvailable <= 0) return 0;
  return prevAvailable;
}
