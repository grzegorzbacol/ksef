import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureValidMonthYear } from "@/lib/closed-periods";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const periods = await prisma.closedPeriod.findMany({
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  return NextResponse.json(
    periods.map((p) => ({
      year: p.year,
      month: p.month,
      createdAt: p.createdAt,
    })),
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const year = Number(body.year);
  const month = Number(body.month);

  try {
    ensureValidMonthYear(year, month);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Nieprawidłowe dane." },
      { status: 400 },
    );
  }

  await prisma.closedPeriod.upsert({
    where: {
      year_month: {
        year,
        month,
      },
    },
    update: {},
    create: { year, month },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  if (!yearParam || !monthParam) {
    return NextResponse.json(
      { error: "Parametry year i month są wymagane." },
      { status: 400 },
    );
  }

  const year = Number(yearParam);
  const month = Number(monthParam);

  try {
    ensureValidMonthYear(year, month);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Nieprawidłowe dane." },
      { status: 400 },
    );
  }

  await prisma.closedPeriod
    .delete({
      where: {
        year_month: {
          year,
          month,
        },
      },
    })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}

