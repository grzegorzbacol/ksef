import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInvoiceToKsef } from "@/lib/ksef";
import type { KsefEnv } from "@/lib/settings";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let env: KsefEnv | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.env === "prod" || body?.env === "test") env = body.env;
  } catch {
    // brak body – użyj domyślnego środowiska
  }

  const result = await sendInvoiceToKsef(invoice, env);
  if (!result.success) {
    const errMsg = result.error || "Błąd KSEF";
    await prisma.invoice.update({
      where: { id },
      data: {
        ksefStatus: "error",
        ksefError: errMsg,
      },
    });
    return NextResponse.json({ error: errMsg }, { status: 502 });
  }

  await prisma.invoice.update({
    where: { id },
    data: {
      ksefSentAt: new Date(),
      ksefId: result.ksefId ?? null,
      ksefStatus: "sent",
      ksefError: null,
    },
  });

  return NextResponse.json({ ok: true, ksefId: result.ksefId });
}
