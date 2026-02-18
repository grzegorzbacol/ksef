import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { getSession } from "@/lib/auth";
import { getInvoicePdfFromKsef } from "@/lib/ksef";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/invoices/[id]/download
 * Zwraca plik faktury: PDF z KSEF (gdy jest ksefId) lub pierwszy załącznik (np. skan).
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
    include: { emailAttachments: { orderBy: { createdAt: "asc" }, take: 1 } },
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

  // 2. Pierwszy załącznik (np. skan z maila lub dodany ręcznie)
  const firstAttachment = invoice.emailAttachments?.[0];
  if (firstAttachment) {
    try {
      const content = await fs.readFile(firstAttachment.storedPath);
      const filename = firstAttachment.filename || `${baseFilename}.pdf`;
      return new NextResponse(content, {
        headers: {
          "Content-Type": firstAttachment.contentType || "application/octet-stream",
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
