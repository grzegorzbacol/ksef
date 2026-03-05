import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  categoryId: z.string().min(1),
  plannedAmount: z.number().min(0),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  const where: { month?: number; year?: number } = {};
  if (month != null && month !== "") where.month = parseInt(month, 10);
  if (year != null && year !== "") where.year = parseInt(year, 10);

  const allocations = await prisma.budgetAllocation.findMany({
    where,
    include: { category: true },
    orderBy: [{ year: "desc" }, { month: "desc" }, { category: { sortOrder: "asc" } }],
  });
  return NextResponse.json(allocations);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane", details: parsed.error.flatten() }, { status: 400 });
  }

  const { month, year, categoryId, plannedAmount } = parsed.data;

  const existing = await prisma.budgetAllocation.findUnique({
    where: { month_year_categoryId: { month, year, categoryId } },
  });

  if (existing) {
    const updated = await prisma.budgetAllocation.update({
      where: { id: existing.id },
      data: { plannedAmount },
      include: { category: true },
    });
    return NextResponse.json(updated);
  }

  const allocation = await prisma.budgetAllocation.create({
    data: { month, year, categoryId, plannedAmount },
    include: { category: true },
  });
  return NextResponse.json(allocation);
}
