import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  date: z.union([z.string(), z.coerce.date()]),
  amount: z.number(),
  categoryId: z.string().min(1),
  memo: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const categoryId = searchParams.get("categoryId");

  const where: { categoryId?: string } & Record<string, unknown> = {};
  if (categoryId) where.categoryId = categoryId;

  if (month != null && month !== "" && year != null && year !== "") {
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    where.date = { gte: start, lte: end };
  }

  const transactions = await prisma.budgetTransaction.findMany({
    where,
    include: { category: true },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane", details: parsed.error.flatten() }, { status: 400 });
  }

  const { date, amount, categoryId, memo } = parsed.data;
  const dateObj = date instanceof Date ? date : new Date(date);

  const tx = await prisma.budgetTransaction.create({
    data: { date: dateObj, amount, categoryId, memo: memo ?? null },
    include: { category: true },
  });
  return NextResponse.json(tx);
}
