import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchInvoicesFromKsef } from "@/lib/ksef";
import { getCompanySettings } from "@/lib/settings";

function normNip(v: string | undefined | null): string {
  return String(v ?? "").replace(/\D/g, "");
}

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
    return NextResponse.json({ ok: false, error: result.error || "Błąd pobierania z KSEF" }, { status: 200 });
  }

  const company = await getCompanySettings();
  const companyNip = normNip(company.nip);
  const imported = result.invoices || [];
  for (const inv of imported) {
    if (!inv?.number) continue;
    try {
      const sellerNip = normNip(inv.sellerNip);
      const buyerNip = normNip(inv.buyerNip);
      // KSEF 2.0 metadata: Subject1/Subject2 mogą mapować seller/buyer odwrotnie niż FA (P_13/P_15).
      // Faktury pobrane z KSEF to głównie zakup (otrzymane). Gdy nasz NIP w polu "seller" metadanych
      // = faktura otrzymana (zakup). Gdy w "buyer" = faktura wystawiona (sprzedaż).
      const type =
        companyNip && sellerNip === companyNip
          ? "cost"   // nasz NIP w seller (metadata) → faktura zakupu (otrzymana)
          : companyNip && buyerNip === companyNip
            ? "sales" // nasz NIP w buyer (metadata) → faktura sprzedaży (wystawiona)
            : "cost"; // brak dopasowania → domyślnie zakup
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
        },
      });
    } catch {
      // duplicate number - skip
    }
  }

  return NextResponse.json({ ok: true, imported: imported.length });
}
