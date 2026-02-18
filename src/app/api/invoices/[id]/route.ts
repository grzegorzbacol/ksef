import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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
    include: { payment: true, items: true, emailAttachments: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: {
    paymentDueDate?: Date | null;
    netAmount?: number;
    vatAmount?: number;
    grossAmount?: number;
    sellerName?: string;
    sellerNip?: string;
    handedOverToAccountant?: boolean;
  } = {};
  if (body.paymentDueDate !== undefined) {
    update.paymentDueDate =
      body.paymentDueDate === null || body.paymentDueDate === ""
        ? null
        : new Date(body.paymentDueDate);
  }
  if (typeof body.netAmount === "number" && body.netAmount >= 0) update.netAmount = body.netAmount;
  if (typeof body.vatAmount === "number" && body.vatAmount >= 0) update.vatAmount = body.vatAmount;
  if (typeof body.grossAmount === "number" && body.grossAmount >= 0)
    update.grossAmount = body.grossAmount;
  if (typeof body.sellerName === "string") update.sellerName = body.sellerName.trim();
  if (typeof body.sellerNip === "string") update.sellerNip = body.sellerNip.trim().replace(/\s/g, "");
  if (typeof body.handedOverToAccountant === "boolean")
    update.handedOverToAccountant = body.handedOverToAccountant;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Brak pól do aktualizacji" }, { status: 400 });
  }
  const invoice = await prisma.invoice.update({
    where: { id },
    data: update,
    include: { payment: true, items: true, emailAttachments: true },
  });
  return NextResponse.json(invoice);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.invoice.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
