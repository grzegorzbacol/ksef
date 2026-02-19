import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: { name?: string; sortOrder?: number } = {};

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Nazwa kategorii nie może być pusta" }, { status: 400 });
    update.name = name;
  }
  if (typeof body.sortOrder === "number") update.sortOrder = body.sortOrder;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Brak pól do aktualizacji" }, { status: 400 });
  }

  const category = await prisma.expenseCategory.update({
    where: { id },
    data: update,
  });
  return NextResponse.json(category);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.expenseCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
