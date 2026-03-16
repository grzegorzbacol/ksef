import { prisma } from "./prisma";

export async function isDateInClosedPeriod(date: Date): Promise<boolean> {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  const existing = await prisma.closedPeriod.findUnique({
    where: {
      year_month: {
        year,
        month,
      },
    },
  });

  return !!existing;
}

export function ensureValidMonthYear(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Nieprawidłowy miesiąc lub rok.");
  }
}

