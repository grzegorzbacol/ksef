import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setAllocation } from "@/modules/personal-budget/lib/budgeting";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const budget = await prisma.personalBudget.findFirst({
    where: { id, userId: session.userId },
  });
  if (!budget) return NextResponse.json({ error: "Nie znaleziono budżetu" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "0", 10);
  const year = parseInt(searchParams.get("year") ?? "0", 10);
  if (!month || !year) {
    return NextResponse.json({ error: "Wymagane parametry: month, year" }, { status: 400 });
  }

  const allocations = await prisma.personalAllocation.findMany({
    where: {
      category: { group: { budgetId: id } },
      month,
      year,
    },
    include: { category: true },
  });
  return NextResponse.json(allocations);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const budget = await prisma.personalBudget.findFirst({
    where: { id, userId: session.userId },
  });
  if (!budget) return NextResponse.json({ error: "Nie znaleziono budżetu" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const categoryId = body.categoryId;
  const month = parseInt(body.month, 10);
  const year = parseInt(body.year, 10);
  const amount = parseFloat(body.amount) || 0;

  if (!categoryId || !month || !year) {
    return NextResponse.json({ error: "Wymagane: categoryId, month, year" }, { status: 400 });
  }

  await setAllocation(id, categoryId, month, year, amount);
  const allocation = await prisma.personalAllocation.findUnique({
    where: { categoryId_month_year: { categoryId, month, year } },
    include: { category: true },
  });
  return NextResponse.json(allocation);
}
