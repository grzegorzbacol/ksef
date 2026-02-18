"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { computePurchaseInvoiceTaxBenefit } from "@/lib/tax-benefits";
import { MonthYearFilter } from "@/components/MonthYearFilter";

type Car = {
  id: string;
  name: string;
  value: number;
  limit100k: number;
  limit150k: number;
  limit200k: number;
  vatDeductionPercent: number;
};

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
  expenseType?: string;
  includedInCosts?: boolean;
  car?: Car | null;
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
  const now = new Date();
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1);
  const [year, setYear] = useState<number | null>(now.getFullYear());

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ type: "cost", payment: "true" });
    if (month != null) params.set("month", String(month));
    if (year != null) params.set("year", String(year));
    Promise.all([
      fetch(`/api/invoices?${params}`).then((r) => r.json()),
      fetch("/api/settings/company").then((r) => r.json()),
    ])
      .then(([invData, companyData]) => {
        setInvoices(Array.isArray(invData) ? invData : []);
        setCompany({
          pitRate: companyData?.pitRate != null ? Number(companyData.pitRate) : 0.12,
          healthRate: companyData?.healthRate != null ? Number(companyData.healthRate) : 0.09,
          isVatPayer: companyData?.isVatPayer !== false && String(companyData?.isVatPayer) !== "false",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month, year]);

  const config: CompanyTax = company ?? {
    pitRate: 0.12,
    healthRate: 0.09,
    isVatPayer: true,
  };

  const totals = invoices.reduce(
    (acc, inv) => {
      const result = computePurchaseInvoiceTaxBenefit(
        {
          grossAmount: inv.grossAmount,
          netAmount: inv.netAmount,
          vatAmount: inv.vatAmount,
          vatDeductionPercent: inv.vatDeductionPercent ?? 1,
          costDeductionPercent: inv.costDeductionPercent ?? 1,
          includedInCosts: inv.includedInCosts ?? false,
          car: inv.expenseType === "car" && inv.car
            ? {
                value: inv.car.value,
                limit100k: inv.car.limit100k,
                limit150k: inv.car.limit150k,
                limit200k: inv.car.limit200k,
                vatDeductionPercent: inv.car.vatDeductionPercent,
              }
            : undefined,
        },
        config
      );
      return {
        gross: acc.gross + inv.grossAmount,
        taxBenefit: acc.taxBenefit + result.totalTaxBenefit,
        realCost: acc.realCost + result.realCost,
      };
    },
    { gross: 0, taxBenefit: 0, realCost: 0 }
  );
  const currency = invoices[0]?.currency ?? "PLN";

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

      <div className="mb-4">
        <MonthYearFilter month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </div>

      {loading ? (
        <p className="text-muted">Ładowanie…</p>
      ) : invoices.length === 0 ? (
        <p className="text-muted">Brak faktur zakupu. Dodaj faktury w module Faktury zakupu.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="p-3 text-left">Numer</th>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Dostawca</th>
                <th className="p-3 text-left">Typ wydatku</th>
                <th className="p-3 text-center">Ujęta</th>
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
                    includedInCosts: inv.includedInCosts ?? false,
                    car: inv.expenseType === "car" && inv.car
                      ? {
                          value: inv.car.value,
                          limit100k: inv.car.limit100k,
                          limit150k: inv.car.limit150k,
                          limit200k: inv.car.limit200k,
                          vatDeductionPercent: inv.car.vatDeductionPercent,
                        }
                      : undefined,
                  },
                  config
                );
                return (
                  <tr key={inv.id} className="border-b border-border">
                    <td className="p-3 font-medium">{inv.number}</td>
                    <td className="p-3">{new Date(inv.issueDate).toLocaleDateString("pl-PL")}</td>
                    <td className="p-3">{inv.sellerName}</td>
                    <td className="p-3 text-muted text-sm">
                      {inv.expenseType === "car" && inv.car ? inv.car.name : "Standardowy"}
                    </td>
                    <td className="p-3 text-center">
                      {inv.includedInCosts ? "Tak" : "—"}
                    </td>
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
                        href={`/dashboard/invoices-sales/${inv.id}`}
                        className="text-accent hover:underline"
                      >
                        Szczegóły
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-bg/50 font-medium">
                <td className="p-3" colSpan={5}>
                  Suma
                </td>
                <td className="p-3 text-right">
                  {totals.gross.toFixed(2)} {currency}
                </td>
                <td className="p-3 text-right text-success">
                  {totals.taxBenefit.toFixed(2)} {currency}
                </td>
                <td className="p-3 text-right">
                  {totals.realCost.toFixed(2)} {currency}
                </td>
                <td className="p-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
