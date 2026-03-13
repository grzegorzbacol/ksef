/**
 * GET /api/invoices/[id]/ksef-xml
 * Zwraca wygenerowany XML FA(2) bez wysyłki – do walidacji lokalnej (XSD) przed wysyłką do KSeF.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/settings";
import { buildFa2Xml } from "@/lib/ksef-send-v2";

export async function GET(
  _req: Request,
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

  if (!invoice.paymentDueDate) {
    return NextResponse.json(
      { error: "Uzupełnij termin płatności – wymagany przy wysyłce do KSeF" },
      { status: 400 }
    );
  }

  try {
    const company = await getCompanySettings();
    const inv = {
      ...invoice,
      paymentDueDate: invoice.paymentDueDate,
      sellerAddress: company.address || null,
      sellerPostalCode: company.postalCode || null,
      sellerCity: company.city || null,
    };
    const xml = buildFa2Xml(inv);
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="fa2-${invoice.number.replace(/[/\\]/g, "-")}.xml"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
