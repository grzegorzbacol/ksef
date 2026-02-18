"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { computePurchaseInvoiceTaxBenefit } from "@/lib/tax-benefits";

type Invoice = {
  id: string;
  number: string;
  issueDate: string;
  sellerName: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  currency: string;
  vatDeductionPercent?: number | null;
  costDeductionPercent?: number | null;
};

type CompanyTax = {
  pitRate: number;
  healthRate: number;
  isVatPayer: boolean;
};

export default function TaxBenefitsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [company, setCompany] = useState<CompanyTax | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/invoices?type=cost&payment=true").then((r) => r.json()),
      fetch("/api/settings/company").then((r) => r.json()),
    ])
      .then(([invData, companyData]) => {
        setInvoices(Array.isArray(invData) ? invData : []);
        setCompany({
          pitRate: companyData?.pitRate != null ? Number(companyData.pitRate) : 0.12,
          healthRate: companyData?.healthRate != null ? Number(companyData.healthRate) : 0.09,
          isVatPayer: companyData?.isVatPayer !== false && companyData?.isVatPayer !== "false",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted">Ładowanie…</p>;

  const config: CompanyTax = company ?? {
    pitRate: 0.12,
    healthRate: 0.09,
    isVatPayer: true,
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Korzyści podatkowe</h1>
        <Link
          href="/dashboard/invoices-sales"
          className="rounded-lg border border-border px-4 py-2 hover:border-accent"
        >
          Faktury zakupu
        </Link>
      </div>
      <p className="text-muted text-sm mb-4">
        Obliczenia dla faktur zakupowych: VAT do odzyskania, oszczędności na PIT i składce zdrowotnej,
        łączna korzyść podatkowa i realny koszt. Stawki ustawiasz w{" "}
        <Link href="/dashboard/settings" className="text-accent hover:underline">
          Ustawienia → Dane firmy
        </Link>
        .
      </p>

      {invoices.length === 0 ? (
        <p className="text-muted">Brak faktur zakupu. Dodaj faktury w module Faktury zakupu.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="p-3 text-left">Numer</th>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Dostawca</th>
                <th className="p-3 text-right">Brutto</th>
                <th className="p-3 text-right">Korzyść podatkowa</th>
                <th className="p-3 text-right">Realny koszt</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const result = computePurchaseInvoiceTaxBenefit(
                  {
                    grossAmount: inv.grossAmount,
                    netAmount: inv.netAmount,
                    vatAmount: inv.vatAmount,
                    vatDeductionPercent: inv.vatDeductionPercent ?? 1,
                    costDeductionPercent: inv.costDeductionPercent ?? 1,
                  },
                  config
                );
                return (
                  <tr key={inv.id} className="border-b border-border">
                    <td className="p-3 font-medium">{inv.number}</td>
                    <td className="p-3">{new Date(inv.issueDate).toLocaleDateString("pl-PL")}</td>
                    <td className="p-3">{inv.sellerName}</td>
                    <td className="p-3 text-right">
                      {inv.grossAmount.toFixed(2)} {inv.currency}
                    </td>
                    <td className="p-3 text-right text-success">
                      {result.totalTaxBenefit.toFixed(2)} {inv.currency}
                    </td>
                    <td className="p-3 text-right">
                      {result.realCost.toFixed(2)} {inv.currency}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/dashboard/invoices/${inv.id}`}
                        className="text-accent hover:underline"
                      >
                        Szczegóły
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
