import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJpkFa } from "@/lib/jpk-fa-parser";

/**
 * POST /api/invoices/import-jpk-fa
 * Importuje faktury sprzedaży z pliku JPK_FA (XML).
 * Przyjmuje multipart/form-data z polem "file".
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let xmlString: string;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Brak pliku. Wybierz plik JPK_FA (XML)." },
        { status: 400 }
      );
    }
    xmlString = await file.text();
  } catch (e) {
    return NextResponse.json(
      { error: "Błąd odczytu pliku: " + (e instanceof Error ? e.message : String(e)) },
      { status: 400 }
    );
  }

  const invoices = parseJpkFa(xmlString);
  if (invoices.length === 0) {
    return NextResponse.json(
      { error: "Nie znaleziono faktur w pliku JPK_FA. Sprawdź format pliku." },
      { status: 400 }
    );
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const inv of invoices) {
    try {
      const existing = await prisma.invoice.findUnique({
        where: { number: inv.number },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const issueDate = new Date(inv.issueDate);
      const saleDate = inv.saleDate ? new Date(inv.saleDate) : null;

      const created = await prisma.invoice.create({
        data: {
          type: "sales",
          number: inv.number,
          issueDate,
          saleDate,
          sellerName: inv.sellerName,
          sellerNip: inv.sellerNip,
          buyerName: inv.buyerName,
          buyerNip: inv.buyerNip,
          netAmount: inv.netAmount,
          vatAmount: inv.vatAmount,
          grossAmount: inv.grossAmount,
          currency: inv.currency,
          source: "jpk-fa",
        },
      });

      for (const row of inv.items) {
        await prisma.invoiceItem.create({
          data: {
            invoiceId: created.id,
            name: row.name,
            quantity: row.quantity,
            unit: row.unit,
            unitPriceNet: row.unitPriceNet,
            vatRate: row.vatRate,
            amountNet: row.amountNet,
            amountVat: row.amountVat,
          },
        });
      }
      imported++;
    } catch (e) {
      errors.push(`${inv.number}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped,
    total: invoices.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
