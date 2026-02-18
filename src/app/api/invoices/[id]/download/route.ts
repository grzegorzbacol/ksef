import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { getSession } from "@/lib/auth";
import { getInvoicePdfFromKsef } from "@/lib/ksef";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/invoices/[id]/download
 * Zwraca plik faktury: PDF z KSEF (gdy jest ksefId) lub załącznik z maila.
 * Przy załącznikach preferuje PDF, pomija JSON/XML (struktury FA).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { emailAttachments: { orderBy: { createdAt: "asc" } } },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const baseFilename = `Faktura_${invoice.number.replace(/\//g, "-")}`;

  // 1. PDF z KSEF
  if (invoice.ksefId && invoice.ksefId.trim() !== "") {
    const result = await getInvoicePdfFromKsef(invoice.ksefId.trim());
    if (result.success) {
      return new NextResponse(result.pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${baseFilename}.pdf"`,
          "Content-Length": String(result.pdf.byteLength),
        },
      });
    }
  }

  // 2. Załącznik z maila – preferuj PDF, pomiń JSON/XML (struktury FA)
  const attachments = invoice.emailAttachments ?? [];
  const isPdf = (att: { contentType: string; filename: string }) =>
    att.contentType?.toLowerCase().includes("pdf") || att.filename?.toLowerCase().endsWith(".pdf");
  const isJsonOrXml = (att: { contentType: string; filename: string }) => {
    const ct = att.contentType?.toLowerCase() ?? "";
    const fn = att.filename?.toLowerCase() ?? "";
    return (
      ct.includes("json") ||
      ct.includes("xml") ||
      fn.endsWith(".json") ||
      fn.endsWith(".xml")
    );
  };
  const pdfAttachment = attachments.find(isPdf);
  const nonDataAttachment = attachments.find((a) => !isJsonOrXml(a));
  const chosenAttachment = pdfAttachment ?? nonDataAttachment ?? attachments[0];
  if (chosenAttachment) {
    try {
      const content = await fs.readFile(chosenAttachment.storedPath);
      const filename = chosenAttachment.filename || `${baseFilename}.pdf`;
      return new NextResponse(content, {
        headers: {
          "Content-Type": chosenAttachment.contentType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filename.replace(/"/g, '\\"')}"`,
        },
      });
    } catch {
      return NextResponse.json({ error: "Plik załącznika niedostępny." }, { status: 404 });
    }
  }

  return NextResponse.json(
    { error: "Brak pliku faktury. Pobierz fakturę z KSEF lub dodaj załącznik w szczegółach." },
    { status: 404 }
  );
}
