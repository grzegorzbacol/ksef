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
    include: {
      accounts: { orderBy: { sortOrder: "asc" } },
      categoryGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          categories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        },
      },
      payees: { orderBy: { name: "asc" } },
    },
  });
  if (!budget) return NextResponse.json({ error: "Nie znaleziono budżetu" }, { status: 404 });
  return NextResponse.json(budget);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const exists = await prisma.personalBudget.findFirst({
    where: { id, userId: session.userId },
  });
  if (!exists) return NextResponse.json({ error: "Nie znaleziono budżetu" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const budget = await prisma.personalBudget.update({
    where: { id },
    data: {
      ...(body.name != null && { name: String(body.name).trim() }),
      ...(body.currency != null && { currency: String(body.currency) }),
    },
  });
  return NextResponse.json(budget);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const exists = await prisma.personalBudget.findFirst({
    where: { id, userId: session.userId },
  });
  if (!exists) return NextResponse.json({ error: "Nie znaleziono budżetu" }, { status: 404 });

  await prisma.personalBudget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
