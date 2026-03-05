import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPersonalBudgetWithDefaults } from "@/modules/personal-budget/lib/init-budget";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const budgets = await prisma.personalBudget.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    include: {
      accounts: { orderBy: { sortOrder: "asc" } },
      categoryGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          categories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        },
      },
    },
  });
  return NextResponse.json(budgets);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "Budżet osobisty").trim();
  if (!name) return NextResponse.json({ error: "Nazwa budżetu jest wymagana" }, { status: 400 });

  const { id } = await createPersonalBudgetWithDefaults(session.userId, name);

  const budget = await prisma.personalBudget.findFirst({
    where: { id, userId: session.userId },
    include: {
      accounts: { orderBy: { sortOrder: "asc" } },
      categoryGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          categories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        },
      },
    },
  });
  if (!budget) return NextResponse.json({ error: "Błąd tworzenia budżetu" }, { status: 500 });
  return NextResponse.json(budget);
}
