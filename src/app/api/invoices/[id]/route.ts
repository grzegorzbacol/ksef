import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDateInClosedPeriod } from "@/lib/closed-periods";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      payment: true,
      items: true,
      emailAttachments: true,
      car: true,
      expenseCategory: true,
      correctionOf: { select: { id: true, number: true } },
      correctedBy: { select: { id: true, number: true } },
    },
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

  const existing = await prisma.invoice.findUnique({
    where: { id },
    select: { issueDate: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Nie znaleziono faktury" }, { status: 404 });
  }
  const originalIssueDate = existing.issueDate;
  const body = await req.json().catch(() => ({}));
  const update: {
    issueDate?: Date;
    saleDate?: Date | null;
    paymentDueDate?: Date | null;
    netAmount?: number;
    vatAmount?: number;
    grossAmount?: number;
    sellerName?: string;
    sellerNip?: string;
    number?: string;
    handedOverToAccountant?: boolean;
    vatDeductionPercent?: number | null;
    costDeductionPercent?: number | null;
    expenseType?: string;
    carId?: string | null;
    includedInCosts?: boolean;
    remarks?: string | null;
    expenseCategoryId?: string | null;
  } = {};
  if (body.issueDate !== undefined) {
    const d = body.issueDate === null || body.issueDate === "" ? null : new Date(body.issueDate);
    if (d && !Number.isNaN(d.getTime())) update.issueDate = d;
  }
  if (body.saleDate !== undefined) {
    update.saleDate =
      body.saleDate === null || body.saleDate === ""
        ? null
        : new Date(body.saleDate);
  }
  if (body.paymentDueDate !== undefined) {
    update.paymentDueDate =
      body.paymentDueDate === null || body.paymentDueDate === ""
        ? null
        : new Date(body.paymentDueDate);
  }
  if (typeof body.netAmount === "number" && !Number.isNaN(body.netAmount)) update.netAmount = body.netAmount;
  if (typeof body.vatAmount === "number" && !Number.isNaN(body.vatAmount)) update.vatAmount = body.vatAmount;
  if (typeof body.grossAmount === "number" && !Number.isNaN(body.grossAmount))
    update.grossAmount = body.grossAmount;
  if (typeof body.sellerName === "string") update.sellerName = body.sellerName.trim();
  if (typeof body.sellerNip === "string") update.sellerNip = body.sellerNip.trim().replace(/\s/g, "");
  if (typeof body.number === "string") {
    const trimmed = body.number.trim();
    if (trimmed) update.number = trimmed;
  }
  if (typeof body.handedOverToAccountant === "boolean")
    update.handedOverToAccountant = body.handedOverToAccountant;
  if (body.vatDeductionPercent !== undefined) {
    const v = body.vatDeductionPercent == null ? null : Number(body.vatDeductionPercent);
    update.vatDeductionPercent = v == null || Number.isNaN(v) ? null : Math.max(0, Math.min(1, v));
  }
  if (body.costDeductionPercent !== undefined) {
    const v = body.costDeductionPercent == null ? null : Number(body.costDeductionPercent);
    update.costDeductionPercent = v == null || Number.isNaN(v) ? null : Math.max(0, Math.min(1, v));
  }
  if (body.expenseType !== undefined) {
    update.expenseType = body.expenseType === "car" ? "car" : "standard";
    if (update.expenseType === "standard") update.carId = null;
  }
  if (body.carId !== undefined) {
    update.carId = body.carId && body.expenseType !== "standard" ? String(body.carId).trim() : null;
  }
  if (typeof body.includedInCosts === "boolean") update.includedInCosts = body.includedInCosts;
  if (body.remarks !== undefined) update.remarks = body.remarks == null || body.remarks === "" ? null : String(body.remarks).trim();
  if (body.expenseCategoryId !== undefined) {
    update.expenseCategoryId = body.expenseCategoryId && String(body.expenseCategoryId).trim() ? String(body.expenseCategoryId).trim() : null;
  }
  const newIssueDate = update.issueDate ?? originalIssueDate;
  if (await isDateInClosedPeriod(originalIssueDate) || (newIssueDate && (await isDateInClosedPeriod(newIssueDate)))) {
    const m = originalIssueDate.getMonth() + 1;
    const y = originalIssueDate.getFullYear();
    return NextResponse.json(
      { error: `Miesiąc ${String(m).padStart(2, "0")}.${y} jest zamknięty. Nie można wprowadzać zmian dla faktur z tego miesiąca.` },
      { status: 400 },
    );
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Brak pól do aktualizacji" }, { status: 400 });
  }
  try {
    const invoice = await prisma.invoice.update({
      where: { id },
      data: update,
      include: { payment: true, items: true, emailAttachments: true, car: true, expenseCategory: true },
    });
    return NextResponse.json(invoice);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Numer faktury jest już używany przez inną fakturę." },
        { status: 400 }
      );
    }
    throw e;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { source: true, emailMessageId: true, issueDate: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Nie znaleziono faktury" }, { status: 404 });
  }
  if (await isDateInClosedPeriod(invoice.issueDate)) {
    const m = invoice.issueDate.getMonth() + 1;
    const y = invoice.issueDate.getFullYear();
    return NextResponse.json(
      { error: `Miesiąc ${String(m).padStart(2, "0")}.${y} jest zamknięty. Nie można usuwać faktur z tego miesiąca.` },
      { status: 400 },
    );
  }
  if (invoice.source === "mail" && invoice.emailMessageId?.trim()) {
    await prisma.deletedMailInvoiceMessageId.upsert({
      where: { emailMessageId: invoice.emailMessageId.trim() },
      create: { emailMessageId: invoice.emailMessageId.trim() },
      update: {},
    });
  }
  await prisma.invoice.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
