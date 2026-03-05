/**
 * Logika kont – saldo, typy, przeliczanie
 */

import { prisma } from "@/lib/prisma";

export async function recalculateAccountBalance(accountId: string) {
  const sum = await prisma.personalTransaction.aggregate({
    where: { accountId },
    _sum: { amount: true },
  });
  const balance = sum._sum.amount ?? 0;
  await prisma.personalAccount.update({
    where: { id: accountId },
    data: { balance },
  });
  return balance;
}

/** Przelicza salda wszystkich kont w budżecie */
export async function recalculateAllAccountBalances(budgetId: string) {
  const accounts = await prisma.personalAccount.findMany({
    where: { budgetId },
  });
  for (const a of accounts) {
    await recalculateAccountBalance(a.id);
  }
}
