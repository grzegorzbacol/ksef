import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchInvoicesFromKsef } from "@/lib/ksef";

/**
 * Cron: co 1h pobiera faktury z KSEF (ostatnie 30 dni) i zapisuje do bazy.
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

  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  try {
    const result = await fetchInvoicesFromKsef(from, to);
    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error || "Błąd pobierania z KSEF" },
        { status: 200 }
      );
    }

    const imported = result.invoices || [];
    for (const inv of imported) {
      if (!inv?.number) continue;
      try {
        const type = "cost" as const;
        await prisma.invoice.upsert({
          where: { number: inv.number },
          create: {
            type,
            number: inv.number,
            issueDate: inv.issueDate ? new Date(inv.issueDate) : new Date(),
            saleDate: inv.saleDate ? new Date(inv.saleDate) : null,
            sellerName: inv.sellerName ?? "",
            sellerNip: inv.sellerNip ?? "",
            buyerName: inv.buyerName ?? "",
            buyerNip: inv.buyerNip ?? "",
            netAmount: inv.netAmount ?? 0,
            vatAmount: inv.vatAmount ?? 0,
            grossAmount: inv.grossAmount ?? 0,
            currency: inv.currency ?? "PLN",
            source: "ksef",
            ksefStatus: "received",
            ksefId: inv.referenceNumber ?? null,
          },
          update: {
            type,
            sellerName: inv.sellerName ?? "",
            sellerNip: inv.sellerNip ?? "",
            buyerName: inv.buyerName ?? "",
            buyerNip: inv.buyerNip ?? "",
            netAmount: inv.netAmount ?? 0,
            vatAmount: inv.vatAmount ?? 0,
            grossAmount: inv.grossAmount ?? 0,
            ksefStatus: "received",
            ...(inv.referenceNumber ? { ksefId: inv.referenceNumber } : {}),
          },
        });
      } catch {
        // duplicate number - skip
      }
    }

    await prisma.invoice.updateMany({
      where: { source: "ksef" },
      data: { type: "cost" },
    });

    return NextResponse.json({ ok: true, imported: imported.length });
  } catch (err) {
    console.error("cron ksef-fetch:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Błąd serwera" },
      { status: 500 }
    );
  }
}
