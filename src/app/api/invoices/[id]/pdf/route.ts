import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInvoicePdfFromKsef } from "@/lib/ksef";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filename = `Faktura_${invoice.number.replace(/\//g, "-")}.pdf`;

  if (!invoice.ksefId || invoice.ksefId.trim() === "") {
    return NextResponse.json(
      {
        error:
          "Brak numeru KSEF dla tej faktury. Pobierz fakturę z KSEF („Pobierz z KSEF”), aby móc pobrać PDF z KSEF.",
      },
      { status: 400 }
    );
  }

  const result = await getInvoicePdfFromKsef(invoice.ksefId.trim());
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Nie udało się pobrać PDF z KSEF." },
      { status: 400 }
    );
  }

  return new NextResponse(result.pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(result.pdf.byteLength),
    },
  });
}
