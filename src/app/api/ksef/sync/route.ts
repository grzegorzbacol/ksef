import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchInvoicesFromKsef } from "@/lib/ksef";
import { getCompanySettings } from "@/lib/settings";
import type { KsefEnv } from "@/lib/settings";

/** Normalizuje NIP do porównania – tylko cyfry */
function normalizeNip(nip: string): string {
  return String(nip ?? "")
    .replace(/\D/g, "")
    .trim();
}

/** Klucz do dopasowania faktury: numer|data|NIP_sprzedawcy */
function matchKey(
  number: string,
  issueDate: string,
  sellerNip: string
): string {
  const num = String(number ?? "").trim();
  const date = String(issueDate ?? "").slice(0, 10);
  const nip = normalizeNip(sellerNip);
  return `${num}|${date}|${nip}`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const dateFrom = (body.dateFrom || body.date_from) as string | undefined;
  const dateTo = (body.dateTo || body.date_to) as string | undefined;
  const env = (body.env === "test" ? "test" : "prod") as KsefEnv | undefined;

  const now = new Date();
  const from =
    dateFrom || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to =
    dateTo || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const result = await fetchInvoicesFromKsef(from, to, env);
  if (!result.success) {
    return NextResponse.json(
      { ok: false, error: result.error || "Błąd pobierania z KSeF" },
      { status: 200 }
    );
  }

  const company = await getCompanySettings();
  const ourNip = normalizeNip(company.nip);

  // Faktury sprzedaży: jesteśmy sprzedawcą (sellerNip = nasz NIP)
  // Budujemy mapę: klucz -> { referenceNumber } z KSeF (Subject1 – my jesteśmy sprzedawcą)
  const inKsef = new Map<string, { referenceNumber?: string }>();
  for (const inv of result.invoices ?? []) {
    const nip = normalizeNip(inv.sellerNip);
    // Uwzględniamy tylko faktury, gdzie my jesteśmy sprzedawcą (lub nie mamy NIP – wtedy wszystko)
    if (ourNip && nip !== ourNip) continue;
    const key = matchKey(inv.number, inv.issueDate, inv.sellerNip);
    inKsef.set(key, { referenceNumber: inv.referenceNumber });
  }

  // Pobierz lokalne faktury sprzedaży w zakresie dat
  const localSales = await prisma.invoice.findMany({
    where: {
      type: "sales",
      issueDate: {
        gte: new Date(from + "T00:00:00"),
        lte: new Date(to + "T23:59:59.999"),
      },
    },
  });

  let updated = 0;
  const notFoundInKsef: string[] = [];

  for (const inv of localSales) {
    const key = matchKey(inv.number, inv.issueDate.toISOString().slice(0, 10), inv.sellerNip);
    const found = inKsef.get(key);

    if (found) {
      // Faktura jest w KSeF – aktualizuj status
      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          ksefId: found.referenceNumber ?? inv.ksefId,
          ksefStatus: "sent",
          ksefError: null,
        },
      });
      updated++;
    } else if (inv.ksefStatus === "sent" || inv.ksefId) {
      // Mieliśmy status „wysłano” lub numer KSeF, ale nie ma w KSeF – możliwe odrzucenie
      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          ksefId: null,
          ksefStatus: "not_in_ksef",
          ksefError:
            "Faktura nie znajduje się w KSeF – możliwe odrzucenie po wysłaniu. Możesz spróbować wysłać ponownie.",
        },
      });
      updated++;
      notFoundInKsef.push(inv.number);
    }
  }

  return NextResponse.json({
    ok: true,
    updated,
    notFoundInKsef,
    ksefCount: result.invoices?.length ?? 0,
  });
}
