import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchInvoicesFromKsef } from "@/lib/ksef";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dateFrom = (body.dateFrom || body.date_from) as string;
  const dateTo = (body.dateTo || body.date_to) as string;

  const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = dateTo || new Date().toISOString().slice(0, 10);

  const result = await fetchInvoicesFromKsef(from, to);
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Błąd pobierania z KSEF" }, { status: 502 });
  }

  const imported = result.invoices || [];
  for (const inv of imported) {
    if (!inv?.number) continue;
    try {
      await prisma.invoice.upsert({
        where: { number: inv.number },
        create: {
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
        },
        update: {},
      });
    } catch {
      // duplicate number - skip
    }
  }

  return NextResponse.json({ ok: true, imported: imported.length });
}
