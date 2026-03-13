import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInvoiceToKsef, fetchInvoicesFromKsef } from "@/lib/ksef";
import { getCompanySettings } from "@/lib/settings";
import type { KsefEnv } from "@/lib/settings";

function normalizeNip(nip: string): string {
  return String(nip ?? "").replace(/\D/g, "").trim();
}

function matchKey(number: string, issueDate: string, sellerNip: string): string {
  return `${String(number ?? "").trim()}|${String(issueDate ?? "").slice(0, 10)}|${normalizeNip(sellerNip)}`;
}

/** Sprawdza, czy faktura jest w KSeF – po wysłaniu może być krótkie opóźnienie indeksowania */
async function verifyInKsef(
  number: string,
  issueDate: Date,
  sellerNip: string,
  env: KsefEnv | undefined
): Promise<boolean> {
  const dateStr = issueDate.toISOString().slice(0, 10);
  const result = await fetchInvoicesFromKsef(dateStr, dateStr, env);
  if (!result.success || !result.invoices) return false;
  const company = await getCompanySettings();
  const ourNip = normalizeNip(company.nip);
  const key = matchKey(number, dateStr, sellerNip);
  for (const inv of result.invoices) {
    if (ourNip && normalizeNip(inv.sellerNip) !== ourNip) continue;
    if (matchKey(inv.number, inv.issueDate, inv.sellerNip) === key) return true;
  }
  return false;
}

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

  // Weryfikacja: sprawdź, czy faktura jest w KSeF (czasem indeksowanie wymaga chwili)
  let inKsef = await verifyInKsef(
    invoice.number,
    invoice.issueDate,
    invoice.sellerNip,
    env
  );
  if (!inKsef) {
    await new Promise((r) => setTimeout(r, 3000));
    inKsef = await verifyInKsef(
      invoice.number,
      invoice.issueDate,
      invoice.sellerNip,
      env
    );
  }
  if (!inKsef) {
    await prisma.invoice.update({
      where: { id },
      data: {
        ksefStatus: "not_in_ksef",
        ksefError:
          "Wysłano do KSeF, ale faktura nie pojawiła się w zapytaniu. Sprawdź w portalu KSeF lub użyj „Sprawdź status w KSeF” za chwilę.",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    ksefId: result.ksefId,
    verifiedInKsef: inKsef,
  });
}
