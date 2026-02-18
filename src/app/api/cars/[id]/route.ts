import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const car = await prisma.car.findUnique({ where: { id } });
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(car);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: {
    name?: string;
    value?: number;
    limit100k?: number;
    limit150k?: number;
    limit200k?: number;
    vatDeductionPercent?: number;
    sortOrder?: number;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Nazwa nie może być pusta" }, { status: 400 });
    update.name = name;
  }
  if (typeof body.value === "number" && body.value >= 0) update.value = body.value;
  if (typeof body.limit100k === "number" && body.limit100k >= 0) update.limit100k = body.limit100k;
  if (typeof body.limit150k === "number" && body.limit150k >= 0) update.limit150k = body.limit150k;
  if (typeof body.limit200k === "number" && body.limit200k >= 0) update.limit200k = body.limit200k;
  if (body.vatDeductionPercent !== undefined) {
    const v = Number(body.vatDeductionPercent);
    update.vatDeductionPercent = v === 1 ? 1 : 0.5;
  }
  if (typeof body.sortOrder === "number") update.sortOrder = body.sortOrder;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Brak pól do aktualizacji" }, { status: 400 });
  }

  const car = await prisma.car.update({
    where: { id },
    data: update,
  });
  return NextResponse.json(car);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.car.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
