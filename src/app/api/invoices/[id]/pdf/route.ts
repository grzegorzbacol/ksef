import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInvoicePdfFromKsef } from "@/lib/ksef";
import { prisma } from "@/lib/prisma";
import { jsPDF } from "jspdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filename = `Faktura_${invoice.number.replace(/\//g, "-")}.pdf`;

  if (invoice.ksefId && invoice.ksefId.trim() !== "") {
    const result = await getInvoicePdfFromKsef(invoice.ksefId.trim());
    if (result.success) {
      return new NextResponse(result.pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(result.pdf.byteLength),
        },
      });
    }
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  let y = margin;
  const lineH = 6;
  const smallH = 5;

  function addLine(text: string, opts?: { font?: "helvetica"; size?: number; bold?: boolean }) {
    const size = opts?.size ?? 10;
    doc.setFontSize(size);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.text(text, margin, y);
    y += lineH;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Faktura ${invoice.number}`, margin, y);
  y += lineH + 4;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  addLine(`Data wystawienia: ${invoice.issueDate.toLocaleDateString("pl-PL")}`);
  if (invoice.saleDate) addLine(`Data sprzedaży: ${invoice.saleDate.toLocaleDateString("pl-PL")}`);
  y += 4;

  addLine("Sprzedawca:", { bold: true });
  addLine(invoice.sellerName, { size: 10 });
  addLine(`NIP: ${invoice.sellerNip}`, { size: 9 });
  y += 4;

  addLine("Nabywca:", { bold: true });
  addLine(invoice.buyerName, { size: 10 });
  addLine(`NIP: ${invoice.buyerNip}`, { size: 9 });
  y += 6;

  if (invoice.items.length > 0) {
    addLine("Pozycje:", { bold: true });
    const colW = [80, 20, 25, 25, 25];
    const headers = ["Nazwa", "Ilość", "Cena netto", "Netto", "VAT"];
    doc.setFont("helvetica", "bold");
    let x = margin;
    headers.forEach((h, i) => {
      doc.text(h, x, y);
      x += colW[i];
    });
    y += lineH;
    doc.setFont("helvetica", "normal");
    for (const it of invoice.items) {
      if (y > 260) {
        doc.addPage();
        y = margin;
      }
      x = margin;
      doc.text(it.name.substring(0, 40), x, y);
      x += colW[0];
      doc.text(`${it.quantity} ${it.unit}`, x, y);
      x += colW[1];
      doc.text(it.unitPriceNet.toFixed(2), x, y);
      x += colW[2];
      doc.text(it.amountNet.toFixed(2), x, y);
      x += colW[3];
      doc.text(it.amountVat.toFixed(2), x, y);
      y += smallH;
    }
    y += 4;
  }

  addLine(`Razem netto: ${invoice.netAmount.toFixed(2)} ${invoice.currency}`);
  addLine(`VAT: ${invoice.vatAmount.toFixed(2)} ${invoice.currency}`);
  addLine(`Razem brutto: ${invoice.grossAmount.toFixed(2)} ${invoice.currency}`, { bold: true });

  const pdfBytes = doc.output("arraybuffer");

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBytes.byteLength),
    },
  });
}
