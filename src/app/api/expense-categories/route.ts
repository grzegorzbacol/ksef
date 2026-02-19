import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await prisma.expenseCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nazwa kategorii jest wymagana" }, { status: 400 });

  const maxOrder = await prisma.expenseCategory
    .aggregate({ _max: { sortOrder: true } })
    .then((r) => (r._max.sortOrder ?? -1) + 1);

  const category = await prisma.expenseCategory.create({
    data: { name, sortOrder: maxOrder },
  });
  return NextResponse.json(category);
}
