import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cars = await prisma.car.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(cars);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nazwa samochodu jest wymagana" }, { status: 400 });

  const value = Number(body.value);
  if (Number.isNaN(value) || value < 0)
    return NextResponse.json({ error: "Wartość musi być liczbą nieujemną" }, { status: 400 });

  const limit100k = Number(body.limit100k);
  const limit150k = Number(body.limit150k);
  const limit200k = Number(body.limit200k);
  const vatPct = body.vatDeductionPercent != null ? Number(body.vatDeductionPercent) : 0.5;
  const vatDeductionPercent = vatPct === 1 ? 1 : 0.5;

  const maxOrder = await prisma.car
    .aggregate({ _max: { sortOrder: true } })
    .then((r) => (r._max.sortOrder ?? -1) + 1);

  const car = await prisma.car.create({
    data: {
      name,
      value,
      limit100k: Number.isNaN(limit100k) ? 100000 : limit100k,
      limit150k: Number.isNaN(limit150k) ? 150000 : limit150k,
      limit200k: Number.isNaN(limit200k) ? 200000 : limit200k,
      vatDeductionPercent,
      sortOrder: maxOrder,
    },
  });
  return NextResponse.json(car);
}
