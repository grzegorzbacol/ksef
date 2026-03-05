import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSpendingByCategory } from "@/modules/personal-budget/lib/reports";

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

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const privateOnly = searchParams.get("privateOnly") === "true";

  const rows = await getSpendingByCategory(id, month, year, {
    includePrivateOnly: privateOnly,
  });
  return NextResponse.json(rows);
}
