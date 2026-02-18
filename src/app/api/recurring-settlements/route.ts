import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateRecurringSettlementsForMonth } from "@/lib/recurring-settlements";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await prisma.recurringSettlement.findMany({
    orderBy: { code: "asc" },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const now = new Date();
  const year = body.year != null ? Number(body.year) : now.getFullYear();
  const month = body.month != null ? Number(body.month) : now.getMonth() + 1;

  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "Nieprawidłowy miesiąc" }, { status: 400 });
  }

  try {
    const result = await generateRecurringSettlementsForMonth(year, month);
    return NextResponse.json({
      ok: true,
      year,
      month,
      created: result.created,
      invoiceIds: result.invoiceIds,
    });
  } catch (err) {
    console.error("recurring-settlements generate:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Błąd generowania" },
      { status: 500 }
    );
  }
}
