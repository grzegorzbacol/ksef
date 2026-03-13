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
  paymentDueDate: z.string().optional().nullable(),
  sellerName: z.string().min(1).optional(),
  sellerNip: z.string().min(1).optional(),
  buyerName: z.string().min(1).optional(),
  buyerNip: z.string().min(1).optional(),
  netAmount: z.number().optional(),
  vatAmount: z.number().optional(),
  grossAmount: z.number().optional(),
  currency: z.string().default("PLN"),
  items: z.array(itemSchema).optional(),
  expenseType: z.enum(["standard", "car"]).optional(),
  carId: z.string().optional().nullable(),
  expenseCategoryId: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  correctionOfId: z.string().optional(),
  /** IDs pozycji do skorygowania (gdy faktura ma pozycje). Gdy brak – koryguje wszystkie. */
  correctionItemIds: z.array(z.string()).optional(),
}).refine(
  (d) => d.correctionOfId || (d.sellerName && d.sellerNip && d.buyerName && d.buyerNip && d.netAmount != null),
  { message: "Dla nowej faktury wymagane: sprzedawca, nabywca i kwoty (lub pozycje). Dla korekty: correctionOfId." }
);

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
      expenseCategory: true,
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

  // Korekta faktury – kopiuje dane z oryginału i neguje kwoty
  let baseData: {
    issueDate: string;
    saleDate?: string;
    sellerName: string;
    sellerNip: string;
    buyerName: string;
    buyerNip: string;
    netAmount: number;
    vatAmount: number;
    grossAmount: number;
    currency: string;
    items?: { productId?: string; name: string; quantity: number; unit: string; unitPriceNet: number; vatRate: number }[];
  };
  let correctionOfId: string | undefined;
  const isCorrection = !!data.correctionOfId;

  if (isCorrection) {
    const original = await prisma.invoice.findUnique({
      where: { id: data.correctionOfId },
      include: { items: true },
    });
    if (!original)
      return NextResponse.json({ error: "Nie znaleziono faktury do skorygowania" }, { status: 404 });
    if (original.type !== "sales")
      return NextResponse.json({ error: "Korekty można wystawiać tylko dla faktur sprzedaży" }, { status: 400 });
    if (original.correctionOfId)
      return NextResponse.json({ error: "Nie można skorygować korekty" }, { status: 400 });
    correctionOfId = original.id;
    const selectedItems =
      original.items.length > 0 && data.correctionItemIds != null && data.correctionItemIds.length > 0
        ? original.items.filter((it) => data.correctionItemIds!.includes(it.id))
        : original.items;
    baseData = {
      issueDate: data.issueDate,
      saleDate: data.saleDate,
      sellerName: original.sellerName,
      sellerNip: original.sellerNip,
      buyerName: original.buyerName,
      buyerNip: original.buyerNip,
      netAmount: -original.netAmount,
      vatAmount: -original.vatAmount,
      grossAmount: -original.grossAmount,
      currency: original.currency,
      items:
        selectedItems.length > 0
          ? selectedItems.map((it) => ({
              productId: it.productId ?? undefined,
              name: it.name,
              quantity: -it.quantity,
              unit: it.unit,
              unitPriceNet: it.unitPriceNet,
              vatRate: it.vatRate,
            }))
          : undefined,
    };
  } else {
    const netAmount = data.netAmount ?? 0;
    const vatAmount = data.vatAmount ?? 0;
    const grossAmount = data.grossAmount ?? netAmount + vatAmount;
    baseData = {
      issueDate: data.issueDate,
      saleDate: data.saleDate,
      sellerName: data.sellerName!,
      sellerNip: data.sellerNip!,
      buyerName: data.buyerName!,
      buyerNip: data.buyerNip!,
      netAmount,
      vatAmount,
      grossAmount,
      currency: data.currency,
    };
  }

  let netAmount = baseData.netAmount;
  let vatAmount = baseData.vatAmount;
  let grossAmount = baseData.grossAmount;

  if (baseData.items && baseData.items.length > 0) {
    netAmount = 0;
    vatAmount = 0;
    for (const row of baseData.items) {
      const lineNet = row.quantity * row.unitPriceNet;
      const lineVat = lineNet * (row.vatRate / 100);
      netAmount += lineNet;
      vatAmount += lineVat;
    }
    grossAmount = netAmount + vatAmount;
  }

  const issueDate = new Date(baseData.issueDate);
  const invoiceType = data.type === "cost" ? "cost" : "sales";

  const invoice = await prisma.$transaction(async (tx) => {
    let number = data.number?.trim();
    if (!number) {
      if (invoiceType === "sales" && !isCorrection) {
        // Format: NUMER/US/MIESIAC/ROK – pierwszy wolny numer (zwolnione po usunięciu faktur)
        const month = issueDate.getMonth() + 1;
        const year = issueDate.getFullYear();
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
        const salesInMonth = await tx.invoice.findMany({
          where: {
            type: "sales",
            correctionOfId: null,
            issueDate: { gte: startOfMonth, lte: endOfMonth },
          },
          select: { number: true },
        });
        const usPattern = /^(\d+)\/US\/\d+\/\d+$/;
        const used = new Set<number>();
        for (const inv of salesInMonth) {
          const m = inv.number.match(usPattern);
          if (m) used.add(parseInt(m[1], 10));
        }
        let nextSeq = 1;
        while (used.has(nextSeq)) nextSeq++;
        number = `${nextSeq}/US/${month}/${year}`;
      } else {
        const prefix = isCorrection ? "FV-K" : invoiceType === "cost" ? "FK" : "FV";
        const year = issueDate.getFullYear();
        const counterKey = isCorrection
          ? `invoice_counter_sales_correction_${year}`
          : `invoice_counter_${invoiceType}_${year}`;
        const row = await tx.setting.findUnique({ where: { key: counterKey } });
        const nextSeq = (row?.value ? parseInt(row.value, 10) : 0) + 1;
        await tx.setting.upsert({
          where: { key: counterKey },
          create: { key: counterKey, value: String(nextSeq) },
          update: { value: String(nextSeq) },
        });
        number = `${prefix}/${year}/${String(nextSeq).padStart(4, "0")}`;
      }
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
        saleDate: baseData.saleDate ? new Date(baseData.saleDate) : null,
        paymentDueDate: data.paymentDueDate ? new Date(data.paymentDueDate) : null,
        sellerName: baseData.sellerName,
        sellerNip: baseData.sellerNip,
        buyerName: baseData.buyerName,
        buyerNip: baseData.buyerNip,
        netAmount,
        vatAmount,
        grossAmount,
        currency: baseData.currency,
        expenseType,
        carId,
        expenseCategoryId: invoiceType === "cost" && data.expenseCategoryId ? data.expenseCategoryId : null,
        remarks: data.remarks?.trim() || null,
        correctionOfId: correctionOfId ?? null,
      },
    });
  });

  const items = baseData.items ?? data.items ?? [];
  if (items.length > 0) {
    for (const row of items) {
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
