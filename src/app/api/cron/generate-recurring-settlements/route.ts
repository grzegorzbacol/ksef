import { NextRequest, NextResponse } from "next/server";
import { generateRecurringSettlementsForMonth } from "@/lib/recurring-settlements";

/**
 * Cron: 1. dzień miesiąca – generuje rozrachunki cykliczne (ZUS, PIT-5, VAT-7) na bieżący miesiąc.
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
    const result = await generateRecurringSettlementsForMonth(year, month);
    return NextResponse.json({
      ok: true,
      year,
      month,
      created: result.created,
      invoiceIds: result.invoiceIds,
    });
  } catch (err) {
    console.error("cron generate-recurring-settlements:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Błąd generowania" },
      { status: 500 }
    );
  }
}
