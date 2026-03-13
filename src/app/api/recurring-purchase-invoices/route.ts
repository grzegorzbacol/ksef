import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateRecurringPurchaseInvoicesForMonth } from "@/lib/recurring-purchase-invoices";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await prisma.recurringPurchaseInvoice.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { expenseCategory: true },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const name = String(body.name ?? "").trim();
  const sellerName = String(body.sellerName ?? "").trim();
  const sellerNip = String(body.sellerNip ?? "").trim();
  const dayOfMonth = body.dayOfMonth != null ? Number(body.dayOfMonth) : null;

  const isCreate = name && sellerName && sellerNip && dayOfMonth != null && dayOfMonth >= 1 && dayOfMonth <= 31;

  if (isCreate) {
    const maxOrder = await prisma.recurringPurchaseInvoice
      .aggregate({ _max: { sortOrder: true } })
      .then((r) => (r._max.sortOrder ?? -1) + 1);

    const template = await prisma.recurringPurchaseInvoice.create({
      data: {
        name,
        dayOfMonth,
        sellerName,
        sellerNip,
        expenseCategoryId: body.expenseCategoryId || null,
        sortOrder: body.sortOrder ?? maxOrder,
      },
      include: { expenseCategory: true },
    });
    return NextResponse.json(template);
  }

  const now = new Date();
  const year = body.year != null ? Number(body.year) : now.getFullYear();
  const month = body.month != null ? Number(body.month) : now.getMonth() + 1;

  if (month < 1 || month > 12) {
    return NextResponse.json({ error: "Nieprawidłowy miesiąc" }, { status: 400 });
  }

  try {
    const result = await generateRecurringPurchaseInvoicesForMonth(year, month);
    return NextResponse.json({
      ok: true,
      year,
      month,
      created: result.created,
      invoiceIds: result.invoiceIds,
    });
  } catch (err) {
    console.error("recurring-purchase-invoices generate:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Błąd generowania" },
      { status: 500 }
    );
  }
}
