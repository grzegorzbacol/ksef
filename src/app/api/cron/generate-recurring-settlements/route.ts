import { NextRequest, NextResponse } from "next/server";
import { generateRecurringSettlementsForMonth } from "@/lib/recurring-settlements";
import { generateRecurringPurchaseInvoicesForMonth } from "@/lib/recurring-purchase-invoices";

/**
 * Cron: 1. dzień miesiąca – generuje rozrachunki cykliczne (ZUS, PIT-5, VAT-7)
 * oraz puste faktury zakupu cykliczne na bieżący miesiąc.
 * Wywołuj przez Vercel Cron lub zewnętrzny cron z Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  try {
    const [settlements, purchaseInvoices] = await Promise.all([
      generateRecurringSettlementsForMonth(year, month),
      generateRecurringPurchaseInvoicesForMonth(year, month),
    ]);
    return NextResponse.json({
      ok: true,
      year,
      month,
      settlements: { created: settlements.created, invoiceIds: settlements.invoiceIds },
      purchaseInvoices: { created: purchaseInvoices.created, invoiceIds: purchaseInvoices.invoiceIds },
    });
  } catch (err) {
    console.error("cron generate-recurring-settlements:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Błąd generowania" },
      { status: 500 }
    );
  }
}
