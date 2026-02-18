import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  number: z.string().min(1),
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
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupBy = searchParams.get("groupBy"); // month | buyer | null
  const includePayment = searchParams.get("payment") === "true";

  const invoices = await prisma.invoice.findMany({
    orderBy: { issueDate: "desc" },
    include: includePayment ? { payment: true } : undefined,
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
    const byBuyer: Record<string, typeof invoices> = {};
    for (const inv of invoices) {
      const key = `${inv.buyerNip} | ${inv.buyerName}`;
      if (!byBuyer[key]) byBuyer[key] = [];
      byBuyer[key].push(inv);
    }
    return NextResponse.json({ groupBy: "buyer", data: byBuyer });
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
  const invoice = await prisma.invoice.create({
    data: {
      number: data.number,
      issueDate: new Date(data.issueDate),
      saleDate: data.saleDate ? new Date(data.saleDate) : null,
      sellerName: data.sellerName,
      sellerNip: data.sellerNip,
      buyerName: data.buyerName,
      buyerNip: data.buyerNip,
      netAmount: data.netAmount,
      vatAmount: data.vatAmount,
      grossAmount: data.grossAmount,
      currency: data.currency,
    },
  });
  return NextResponse.json(invoice);
}
