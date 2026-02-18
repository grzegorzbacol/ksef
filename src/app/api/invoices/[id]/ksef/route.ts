import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInvoiceToKsef } from "@/lib/ksef";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await sendInvoiceToKsef(invoice);
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Błąd KSEF" }, { status: 502 });
  }

  await prisma.invoice.update({
    where: { id },
    data: {
      ksefSentAt: new Date(),
      ksefId: result.ksefId ?? null,
      ksefStatus: "sent",
    },
  });

  return NextResponse.json({ ok: true, ksefId: result.ksefId });
}
