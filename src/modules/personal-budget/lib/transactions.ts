/**
 * Logika transakcji – tworzenie, aktualizacja, karty kredytowe
 */

import { prisma } from "@/lib/prisma";

export interface CreateTransactionInput {
  budgetId: string;
  accountId: string;
  date: Date;
  payeeId?: string | null;
  categoryId?: string | null;
  amount: number;
  memo?: string | null;
  cleared?: boolean;
  isPrivate?: boolean;
}

/** Tworzy transakcję i aktualizuje saldo konta */
export async function createTransaction(input: CreateTransactionInput) {
  const tx = await prisma.$transaction(async (pr) => {
    const t = await pr.personalTransaction.create({
      data: {
        budgetId: input.budgetId,
        accountId: input.accountId,
        date: input.date,
        payeeId: input.payeeId ?? undefined,
        categoryId: input.categoryId ?? undefined,
        amount: input.amount,
        memo: input.memo ?? undefined,
        cleared: input.cleared ?? false,
        isPrivate: input.isPrivate ?? false,
      },
      include: {
        account: true,
        category: true,
        payee: true,
      },
    });
    await updateAccountBalance(pr, input.accountId, input.amount);
    return t;
  });
  return tx;
}

/** Aktualizuje transakcję – zmiana kwoty wymaga korekty salda */
export async function updateTransaction(
  id: string,
  data: Partial<CreateTransactionInput>
) {
  const existing = await prisma.personalTransaction.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!existing) throw new Error("Transakcja nie istnieje");

  const amountDelta = data.amount !== undefined ? data.amount - existing.amount : 0;

  const tx = await prisma.$transaction(async (pr) => {
    const t = await pr.personalTransaction.update({
      where: { id },
      data: {
        ...(data.accountId !== undefined && { accountId: data.accountId }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.payeeId !== undefined && { payeeId: data.payeeId }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.memo !== undefined && { memo: data.memo }),
        ...(data.cleared !== undefined && { cleared: data.cleared }),
        ...(data.isPrivate !== undefined && { isPrivate: data.isPrivate }),
      },
      include: { account: true, category: true, payee: true },
    });
    if (amountDelta !== 0) {
      await updateAccountBalance(pr, existing.accountId, amountDelta);
      if (data.accountId && data.accountId !== existing.accountId) {
        await updateAccountBalance(pr, data.accountId, data.amount!);
        await updateAccountBalance(pr, existing.accountId, -existing.amount);
      }
    }
    return t;
  });
  return tx;
}

/** Usuwa transakcję i koryguje saldo */
export async function deleteTransaction(id: string) {
  const t = await prisma.personalTransaction.findUnique({ where: { id } });
  if (!t) throw new Error("Transakcja nie istnieje");

  await prisma.$transaction(async (pr) => {
    await pr.personalTransaction.delete({ where: { id } });
    await updateAccountBalance(pr, t.accountId, -t.amount);
  });
}

async function updateAccountBalance(
  pr: Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  accountId: string,
  delta: number
) {
  await pr.personalAccount.update({
    where: { id: accountId },
    data: { balance: { increment: delta } },
  });
}

/** Sugeruje kategorię na podstawie payee (PersonalPayeeCategory) */
export async function suggestCategoryForPayee(budgetId: string, payeeName: string) {
  const payee = await prisma.personalPayee.findFirst({
    where: { budgetId, name: { equals: payeeName, mode: "insensitive" } },
    include: { defaultCategory: { include: { category: true } } },
  });
  return payee?.defaultCategory[0]?.category ?? null;
}

/** Ustawia domyślną kategorię dla payee */
export async function setPayeeDefaultCategory(payeeId: string, categoryId: string) {
  await prisma.personalPayeeCategory.upsert({
    where: { payeeId },
    create: { payeeId, categoryId },
    update: { categoryId },
  });
}
