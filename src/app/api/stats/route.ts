import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function computeStats(invoices: { grossAmount: number; netAmount: number; vatAmount: number; issueDate: Date }[], payments: { invoice: { grossAmount: number } }[]) {
  const totalGross = invoices.reduce((s, i) => s + i.grossAmount, 0);
  const totalNet = invoices.reduce((s, i) => s + i.netAmount, 0);
  const totalVat = invoices.reduce((s, i) => s + i.vatAmount, 0);
  const paidGross = payments.reduce((s, p) => s + p.invoice.grossAmount, 0);
  const unpaidGross = totalGross - paidGross;

  const byMonth: Record<string, { count: number; gross: number }> = {};
  for (const inv of invoices) {
    const key = `${inv.issueDate.getFullYear()}-${String(inv.issueDate.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { count: 0, gross: 0 };
    byMonth[key].count += 1;
    byMonth[key].gross += inv.grossAmount;
  }

  return {
    totalInvoices: invoices.length,
    totalGross,
    totalNet,
    totalVat,
    paidCount: payments.length,
    paidGross,
    unpaidGross,
    byMonth: Object.entries(byMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [invoicesSales, invoicesCost, payments] = await Promise.all([
    prisma.invoice.findMany({ where: { type: "sales" }, include: { payment: true } }),
    prisma.invoice.findMany({ where: { type: "cost" }, include: { payment: true } }),
    prisma.payment.findMany({ include: { invoice: true } }),
  ]);

  const paymentsByInvoiceId = new Map(payments.map((p) => [p.invoiceId, p]));

  const salesPayments = invoicesSales
    .filter((inv) => paymentsByInvoiceId.has(inv.id))
    .map((inv) => ({ invoice: { grossAmount: inv.grossAmount } }));
  const costPayments = invoicesCost
    .filter((inv) => paymentsByInvoiceId.has(inv.id))
    .map((inv) => ({ invoice: { grossAmount: inv.grossAmount } }));

  const sales = computeStats(invoicesSales, salesPayments);
  const cost = computeStats(invoicesCost, costPayments);

  return NextResponse.json({
    sales,
    cost,
  });
}
