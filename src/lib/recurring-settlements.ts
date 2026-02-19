import { prisma } from "./prisma";
import { getCompanySettings } from "./settings";

function firstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

/** Mapowanie kodu na nazwę typu opłaty (identyfikowalna) */
const CODE_TO_LABEL: Record<string, string> = {
  zus: "ZUS",
  pit5: "PIT-5",
  vat7: "VAT-7",
};

/**
 * Generuje opłaty cykliczne (ZUS, PIT-5, VAT-7) na podany miesiąc.
 * To NIE są faktury – to opłaty identyfikowalne według typu. Numer: OPŁ/VAT-7/YYYY/MM.
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
    const label = CODE_TO_LABEL[r.code] ?? r.name;
    const number = `OPŁ/${label}/${year}/${String(month).padStart(2, "0")}`;

    const invoice = await prisma.invoice.create({
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
    created.push(invoice.id);
  }

  return { created: created.length, invoiceIds: created };
}
