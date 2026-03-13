import { prisma } from "./prisma";
import { getCompanySettings } from "./settings";

function firstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

/** Dzień miesiąca z uwzględnieniem krótszych miesięcy (np. luty 30 → 28/29). */
function clampDayOfMonth(year: number, month: number, day: number): number {
  const lastDay = new Date(year, month, 0).getDate();
  return Math.min(day, lastDay);
}

/**
 * Generuje puste faktury zakupu cykliczne na podany miesiąc.
 * Każda faktura ma datę wystawienia = dayOfMonth (np. 10.) i kwoty 0 PLN bez pozycji – widoczna jako pusta.
 */
export async function generateRecurringPurchaseInvoicesForMonth(
  year: number,
  month: number
): Promise<{ created: number; invoiceIds: string[] }> {
  const company = await getCompanySettings();
  const templates = await prisma.recurringPurchaseInvoice.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { expenseCategory: true },
  });
  const start = firstDayOfMonth(year, month);
  const end = lastDayOfMonth(year, month);

  const created: string[] = [];

  for (const t of templates) {
    const day = clampDayOfMonth(year, month, t.dayOfMonth);
    const issueDate = new Date(year, month - 1, day, 12, 0, 0, 0);

    const existing = await prisma.invoice.findFirst({
      where: {
        type: "cost",
        recurringPurchaseInvoiceId: t.id,
        issueDate: { gte: start, lte: end },
      },
    });
    if (existing) continue;

    const yearStr = issueDate.getFullYear();
    const counterKey = `invoice_counter_cost_${yearStr}`;
    const row = await prisma.setting.findUnique({ where: { key: counterKey } });
    const nextSeq = (row?.value ? parseInt(row.value, 10) : 0) + 1;
    await prisma.setting.upsert({
      where: { key: counterKey },
      create: { key: counterKey, value: String(nextSeq) },
      update: { value: String(nextSeq) },
    });
    const number = `FK/${yearStr}/${String(nextSeq).padStart(4, "0")}`;

    const invoice = await prisma.invoice.create({
      data: {
        type: "cost",
        number,
        issueDate,
        saleDate: null,
        sellerName: t.sellerName,
        sellerNip: t.sellerNip,
        buyerName: company.name || "Firma",
        buyerNip: company.nip || "0000000000",
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0,
        currency: "PLN",
        source: "recurring",
        recurringPurchaseInvoiceId: t.id,
        expenseCategoryId: t.expenseCategoryId,
      },
    });
    created.push(invoice.id);
  }

  return { created: created.length, invoiceIds: created };
}
