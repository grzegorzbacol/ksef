import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchInvoicesFromKsef } from "@/lib/ksef";
import { getCompanySettings } from "@/lib/settings";

function normalizeNip(nip: string): string {
  return String(nip ?? "").replace(/\D/g, "").trim();
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dateFrom = (body.dateFrom || body.date_from) as string;
  const dateTo = (body.dateTo || body.date_to) as string;
  // Gdy env niepodany – fetchInvoicesFromKsef użyje getKsefActiveEnv() (test/prod z ustawień)
  const env = body.env === "test" ? "test" : body.env === "prod" ? "prod" : undefined;

  const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = dateTo || new Date().toISOString().slice(0, 10);

  // Subject2 = my jesteśmy nabywcą = faktury zakupu
  const result = await fetchInvoicesFromKsef(from, to, env, "Subject2");
  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error || "Błąd pobierania z KSEF" }, { status: 200 });
  }

  const company = await getCompanySettings();
  const ourNip = normalizeNip(company.nip);

  // Tylko faktury zakupu: my jesteśmy nabywcą (buyerNip = nasz NIP).
  // Faktury sprzedaży (gdzie my jesteśmy sprzedawcą) NIE trafiają do faktur zakupu.
  const allFromKsef = result.invoices || [];
  const imported = ourNip
    ? allFromKsef.filter((inv) => normalizeNip(inv.buyerNip) === ourNip)
    : allFromKsef;
  for (const inv of imported) {
    if (!inv?.number) continue;
    try {
      // Wszystkie faktury pobrane z KSEF traktujemy jako zakup – przycisk jest tylko na stronie Faktury zakupu.
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

  // Popraw istniejące faktury KSEF (tylko te, gdzie jesteśmy nabywcą – nie zmieniamy typu faktur sprzedaży).
  if (ourNip) {
    const ksefInvoices = await prisma.invoice.findMany({
      where: { source: "ksef" },
      select: { id: true, buyerNip: true },
    });
    const toFix = ksefInvoices.filter((i) => normalizeNip(i.buyerNip) === ourNip);
    if (toFix.length > 0) {
      await prisma.invoice.updateMany({
        where: { id: { in: toFix.map((i) => i.id) } },
        data: { type: "cost" },
      });
    }
  }

  return NextResponse.json({ ok: true, imported: imported.length });
}
