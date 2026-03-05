import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  date: z.union([z.string(), z.coerce.date()]).optional(),
  amount: z.number().optional(),
  categoryId: z.string().min(1).optional(),
  memo: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane", details: parsed.error.flatten() }, { status: 400 });
  }

  const update: { date?: Date; amount?: number; categoryId?: string; memo?: string | null } = {};
  if (parsed.data.date !== undefined) update.date = new Date(parsed.data.date);
  if (parsed.data.amount !== undefined) update.amount = parsed.data.amount;
  if (parsed.data.categoryId !== undefined) update.categoryId = parsed.data.categoryId;
  if (parsed.data.memo !== undefined) update.memo = parsed.data.memo;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Brak pól do aktualizacji" }, { status: 400 });
  }

  const tx = await prisma.budgetTransaction.update({
    where: { id },
    data: update,
    include: { category: true },
  });
  return NextResponse.json(tx);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.budgetTransaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
