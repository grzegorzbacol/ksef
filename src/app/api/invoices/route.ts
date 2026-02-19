import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().default("szt."),
  unitPriceNet: z.number().min(0),
  vatRate: z.number().min(0).max(100),
});

const createSchema = z.object({
  type: z.enum(["cost", "sales"]).default("sales"),
  number: z.string().optional(),
  issueDate: z.string(),
  saleDate: z.string().optional(),
  sellerName: z.string().min(1),
  sellerNip: z.string().min(1),
  buyerName: z.string().min(1),
  buyerNip: z.string().min(1),
  netAmount: z.number(),
  vatAmount: z.number(),
  grossAmount: z.number(),
  currency: z.string().default("PLN"),
  items: z.array(itemSchema).optional(),
  expenseType: z.enum(["standard", "car"]).optional(),
  carId: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupBy = searchParams.get("groupBy"); // month | buyer | null
  const includePayment = searchParams.get("payment") === "true";
  const typeFilter = searchParams.get("type"); // "cost" | "sales"
  const sourceFilter = searchParams.get("source"); // "recurring" = tylko opłaty VAT-7, PIT-5, ZUS

  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");
  const month = monthParam ? parseInt(monthParam, 10) : null;
  const year = yearParam ? parseInt(yearParam, 10) : null;

  const dateFilter =
    month != null &&
    year != null &&
    month >= 1 &&
    month <= 12 &&
    year >= 2020 &&
    year <= 2030
      ? {
          issueDate: {
            gte: new Date(year, month - 1, 1),
            lte: new Date(year, month, 0, 23, 59, 59, 999),
          },
        }
      : undefined;

  const whereClause = {
    ...(typeFilter === "cost" || typeFilter === "sales" ? { type: typeFilter } : {}),
    ...(sourceFilter === "recurring" ? { source: "recurring" } : {}),
    ...(dateFilter ?? {}),
  };

  const invoices = await prisma.invoice.findMany({
    where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
    orderBy: { issueDate: "desc" },
    include: {
      ...(includePayment ? { payment: true } : {}),
      car: true,
    },
  });

  if (groupBy === "month") {
    const byMonth: Record<string, typeof invoices> = {};
    for (const inv of invoices) {
      const key = `${inv.issueDate.getFullYear()}-${String(inv.issueDate.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(inv);
    }
    return NextResponse.json({ groupBy: "month", data: byMonth });
  }

  if (groupBy === "buyer") {
    const byParty: Record<string, typeof invoices> = {};
    for (const inv of invoices) {
      const key = typeFilter === "cost"
        ? `${inv.sellerNip} | ${inv.sellerName}`
        : `${inv.buyerNip} | ${inv.buyerName}`;
      if (!byParty[key]) byParty[key] = [];
      byParty[key].push(inv);
    }
    return NextResponse.json({ groupBy: "buyer", data: byParty });
  }

  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    const msg = Object.values(flat.fieldErrors).flat().join(" ") || "Błąd walidacji";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const data = parsed.data;
  let netAmount = data.netAmount;
  let vatAmount = data.vatAmount;
  let grossAmount = data.grossAmount;

  if (data.items && data.items.length > 0) {
    netAmount = 0;
    vatAmount = 0;
    for (const row of data.items) {
      const lineNet = row.quantity * row.unitPriceNet;
      const lineVat = lineNet * (row.vatRate / 100);
      netAmount += lineNet;
      vatAmount += lineVat;
    }
    grossAmount = netAmount + vatAmount;
  }

  const issueDate = new Date(data.issueDate);

  const invoiceType = data.type === "cost" ? "cost" : "sales";
  const prefix = invoiceType === "cost" ? "FK" : "FV";

  const invoice = await prisma.$transaction(async (tx) => {
    let number = data.number?.trim();
    if (!number) {
      const year = issueDate.getFullYear();
      const key = `invoice_counter_${invoiceType}_${year}`;
      const row = await tx.setting.findUnique({ where: { key } });
      const nextSeq = (row?.value ? parseInt(row.value, 10) : 0) + 1;
      await tx.setting.upsert({
        where: { key },
        create: { key, value: String(nextSeq) },
        update: { value: String(nextSeq) },
      });
      number = `${prefix}/${year}/${String(nextSeq).padStart(4, "0")}`;
    }

    const expenseType = invoiceType === "cost" && data.expenseType === "car" && data.carId
      ? "car"
      : "standard";
    const carId = expenseType === "car" ? data.carId : null;

    return tx.invoice.create({
      data: {
        type: invoiceType,
        number,
        issueDate,
        saleDate: data.saleDate ? new Date(data.saleDate) : null,
        sellerName: data.sellerName,
        sellerNip: data.sellerNip,
        buyerName: data.buyerName,
        buyerNip: data.buyerNip,
        netAmount,
        vatAmount,
        grossAmount,
        currency: data.currency,
        expenseType,
        carId,
        remarks: data.remarks?.trim() || null,
      },
    });
  });

  if (data.items && data.items.length > 0) {
    for (const row of data.items) {
      const amountNet = row.quantity * row.unitPriceNet;
      const amountVat = amountNet * (row.vatRate / 100);
      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          productId: row.productId || null,
          name: row.name,
          quantity: row.quantity,
          unit: row.unit,
          unitPriceNet: row.unitPriceNet,
          vatRate: row.vatRate,
          amountNet,
          amountVat,
        },
      });
    }
  }

  return NextResponse.json(invoice);
}
