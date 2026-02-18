import { prisma } from "./prisma";
import { getCompanySettings } from "./settings";

function firstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

/**
 * Generuje rozrachunki cykliczne (ZUS, PIT-5, VAT-7) na podany miesiąc.
 * Dla każdego typu tworzy jedną fakturę kosztową z kwotą 0 do ręcznego uzupełnienia, jeśli jeszcze nie istnieje.
 */
export async function generateRecurringSettlementsForMonth(
  year: number,
  month: number
): Promise<{ created: number; invoiceIds: string[] }> {
  const company = await getCompanySettings();
  const recurring = await prisma.recurringSettlement.findMany({ orderBy: { code: "asc" } });
  const start = firstDayOfMonth(year, month);
  const end = lastDayOfMonth(year, month);

  const created: string[] = [];

  for (const r of recurring) {
    const existing = await prisma.invoice.findFirst({
      where: {
        type: "cost",
        recurringCode: r.code,
        issueDate: { gte: start, lte: end },
      },
    });
    if (existing) continue;

    const issueDate = firstDayOfMonth(year, month);
    const invoice = await prisma.$transaction(async (tx) => {
      const key = `invoice_counter_cost_${year}`;
      const row = await tx.setting.findUnique({ where: { key } });
      const nextSeq = (row?.value ? parseInt(row.value, 10) : 0) + 1;
      await tx.setting.upsert({
        where: { key },
        create: { key, value: String(nextSeq) },
        update: { value: String(nextSeq) },
      });
      const number = `FK/${year}/${String(nextSeq).padStart(4, "0")}`;

      return tx.invoice.create({
        data: {
          type: "cost",
          number,
          issueDate,
          saleDate: null,
          sellerName: r.sellerName || r.name,
          sellerNip: r.sellerNip || "0000000000",
          buyerName: company.name || "Firma",
          buyerNip: company.nip || "0000000000",
          netAmount: 0,
          vatAmount: 0,
          grossAmount: 0,
          currency: "PLN",
          source: "recurring",
          recurringCode: r.code,
        },
      });
    });
    created.push(invoice.id);
  }

  return { created: created.length, invoiceIds: created };
}
