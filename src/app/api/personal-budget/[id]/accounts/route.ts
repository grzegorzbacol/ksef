import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const accounts = await prisma.personalAccount.findMany({
    where: { budgetId: id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(accounts);
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
  const name = String(body.name ?? "").trim();
  const type = String(body.type ?? "checking");
  const isOnBudget = body.isOnBudget !== false;

  if (!name) return NextResponse.json({ error: "Nazwa konta jest wymagana" }, { status: 400 });

  const maxOrder = await prisma.personalAccount
    .aggregate({ where: { budgetId: id }, _max: { sortOrder: true } })
    .then((r) => (r._max.sortOrder ?? -1) + 1);

  const account = await prisma.personalAccount.create({
    data: {
      budgetId: id,
      name,
      type,
      isOnBudget,
      sortOrder: maxOrder,
    },
  });
  return NextResponse.json(account);
}
