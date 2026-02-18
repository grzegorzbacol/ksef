import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchInvoicesFromMail } from "@/lib/mail-fetch";

/**
 * Cron: co 15 min sprawdza skrzynkę e-mail i importuje faktury.
 * Wywoływany przez Vercel Cron (GET) lub zewnętrzny cron z Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await fetchInvoicesFromMail(prisma);
    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error || "Błąd pobierania z maila" },
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: true, imported: result.imported ?? 0 });
  } catch (err) {
    console.error("cron mail-fetch:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Błąd serwera" },
      { status: 500 }
    );
  }
}
