import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await prisma.product.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const unit = String(body.unit ?? "szt.").trim() || "szt.";
  const priceNet = Number(body.priceNet);
  const vatRate = Number(body.vatRate);

  if (!name || isNaN(priceNet) || priceNet < 0) {
    return NextResponse.json({ error: "Nazwa i cena netto (≥ 0) są wymagane." }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      name,
      description: description || undefined,
      unit,
      priceNet: priceNet,
      vatRate: isNaN(vatRate) ? 23 : Math.max(0, Math.min(100, vatRate)),
    },
  });
  return NextResponse.json(product);
}
