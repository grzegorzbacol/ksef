"use client";

import { useEffect, useState } from "react";

type Invoice = {
  id: string;
  number: string;
  issueDate: string;
  sellerName: string;
  grossAmount: number;
  currency: string;
  payment?: { paidAt: string } | null;
};

export default function RozrachunkiPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/invoices?type=cost&payment=true")
      .then((r) => r.json())
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePaid(invoiceId: string) {
    setToggling(invoiceId);
    try {
      const res = await fetch("/api/payments/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Błąd");
        return;
      }
      load();
    } finally {
      setToggling(null);
    }
  }

  if (loading) return <p className="text-muted">Ładowanie…</p>;

  const paidCount = invoices.filter((i) => i.payment).length;
  const unpaidCount = invoices.length - paidCount;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Rozrachunki</h1>
      <p className="text-muted text-sm mb-6">
        Zaznacz checkbox, aby zarejestrować rozliczenie faktury (zapisujemy datę).
      </p>

      <div className="mb-6 flex gap-4 text-sm">
        <span className="text-success">Rozliczone: {paidCount}</span>
        <span className="text-warning">Nierozliczone: {unpaidCount}</span>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg/50">
              <th className="p-3 text-left w-12">Rozliczono</th>
              <th className="p-3 text-left">Numer</th>
              <th className="p-3 text-left">Data</th>
              <th className="p-3 text-left">Wystawca</th>
              <th className="p-3 text-right">Brutto</th>
              <th className="p-3 text-left">Data rozliczenia</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted">
                  Brak faktur. Dodaj faktury w module Faktury.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={!!inv.payment}
                      disabled={toggling === inv.id}
                      onChange={() => togglePaid(inv.id)}
                      className="h-4 w-4 rounded border-border bg-bg text-accent focus:ring-accent"
                    />
                  </td>
                  <td className="p-3 font-medium">{inv.number}</td>
                  <td className="p-3">{new Date(inv.issueDate).toLocaleDateString("pl-PL")}</td>
                  <td className="p-3">{inv.sellerName}</td>
                  <td className="p-3 text-right">{inv.grossAmount.toFixed(2)} {inv.currency}</td>
                  <td className="p-3 text-muted">
                    {inv.payment
                      ? new Date(inv.payment.paidAt).toLocaleString("pl-PL")
                      : "–"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
