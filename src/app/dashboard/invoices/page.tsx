"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Invoice = {
  id: string;
  number: string;
  issueDate: string;
  saleDate: string | null;
  sellerName: string;
  sellerNip: string;
  buyerName: string;
  buyerNip: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  currency: string;
  ksefSentAt: string | null;
  ksefId: string | null;
  ksefStatus: string | null;
  source: string;
  payment?: { paidAt: string } | null;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchKsefLoading, setFetchKsefLoading] = useState(false);
  const [fetchRange, setFetchRange] = useState({ from: "", to: "" });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    number: "",
    issueDate: new Date().toISOString().slice(0, 10),
    saleDate: "",
    sellerName: "",
    sellerNip: "",
    buyerName: "",
    buyerNip: "",
    netAmount: "",
    vatAmount: "",
    grossAmount: "",
    currency: "PLN",
  });

  function loadInvoices() {
    setLoading(true);
    fetch("/api/invoices?payment=true")
      .then((r) => r.json())
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const net = parseFloat(form.netAmount) || 0;
    const vat = parseFloat(form.vatAmount) || 0;
    const gross = parseFloat(form.grossAmount) || net + vat;
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: form.number,
        issueDate: form.issueDate,
        saleDate: form.saleDate || undefined,
        sellerName: form.sellerName,
        sellerNip: form.sellerNip,
        buyerName: form.buyerName,
        buyerNip: form.buyerNip,
        netAmount: net,
        vatAmount: vat,
        grossAmount: gross,
        currency: form.currency,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Błąd zapisu");
      return;
    }
    setShowForm(false);
    setForm({
      number: "",
      issueDate: new Date().toISOString().slice(0, 10),
      saleDate: "",
      sellerName: "",
      sellerNip: "",
      buyerName: "",
      buyerNip: "",
      netAmount: "",
      vatAmount: "",
      grossAmount: "",
      currency: "PLN",
    });
    loadInvoices();
  }

  async function sendToKsef(id: string) {
    const res = await fetch(`/api/invoices/${id}/ksef`, { method: "POST" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Błąd wysyłki do KSEF");
      return;
    }
    loadInvoices();
  }

  async function fetchFromKsef() {
    setFetchKsefLoading(true);
    const res = await fetch("/api/ksef/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dateFrom: fetchRange.from || undefined,
        dateTo: fetchRange.to || undefined,
      }),
    });
    setFetchKsefLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) alert(data.error || "Błąd pobierania z KSEF");
    else {
      alert(`Zaimportowano: ${data.imported ?? 0} faktur.`);
      loadInvoices();
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Faktury</h1>
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-2 items-center text-sm">
            <input
              type="date"
              value={fetchRange.from}
              onChange={(e) => setFetchRange((p) => ({ ...p, from: e.target.value }))}
              className="rounded border border-border bg-bg px-2 py-1"
            />
            <input
              type="date"
              value={fetchRange.to}
              onChange={(e) => setFetchRange((p) => ({ ...p, to: e.target.value }))}
              className="rounded border border-border bg-bg px-2 py-1"
            />
            <button
              type="button"
              onClick={fetchFromKsef}
              disabled={fetchKsefLoading}
              className="rounded bg-card border border-border px-3 py-1 hover:border-accent"
            >
              Pobierz z KSEF
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90"
          >
            {showForm ? "Anuluj" : "Nowa faktura"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-medium">Nowa faktura</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-muted mb-1">Numer</label>
              <input
                value={form.number}
                onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Data wystawienia</label>
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => setForm((p) => ({ ...p, issueDate: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Data sprzedaży (opcjonalnie)</label>
              <input
                type="date"
                value={form.saleDate}
                onChange={(e) => setForm((p) => ({ ...p, saleDate: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-muted mb-1">Sprzedawca – nazwa</label>
              <input
                value={form.sellerName}
                onChange={(e) => setForm((p) => ({ ...p, sellerName: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Sprzedawca – NIP</label>
              <input
                value={form.sellerNip}
                onChange={(e) => setForm((p) => ({ ...p, sellerNip: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Nabywca – nazwa</label>
              <input
                value={form.buyerName}
                onChange={(e) => setForm((p) => ({ ...p, buyerName: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Nabywca – NIP</label>
              <input
                value={form.buyerNip}
                onChange={(e) => setForm((p) => ({ ...p, buyerNip: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-sm text-muted mb-1">Netto</label>
              <input
                type="number"
                step="0.01"
                value={form.netAmount}
                onChange={(e) => setForm((p) => ({ ...p, netAmount: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">VAT</label>
              <input
                type="number"
                step="0.01"
                value={form.vatAmount}
                onChange={(e) => setForm((p) => ({ ...p, vatAmount: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Brutto</label>
              <input
                type="number"
                step="0.01"
                value={form.grossAmount}
                onChange={(e) => setForm((p) => ({ ...p, grossAmount: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Waluta</label>
              <input
                value={form.currency}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
          </div>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90">
            Zapisz fakturę
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-muted">Ładowanie…</p>
      ) : invoices.length === 0 ? (
        <p className="text-muted">Brak faktur. Dodaj pierwszą lub pobierz z KSEF.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="p-3 text-left">Numer</th>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Nabywca</th>
                <th className="p-3 text-right">Brutto</th>
                <th className="p-3">KSEF</th>
                <th className="p-3">Opłacono</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border">
                  <td className="p-3 font-medium">{inv.number}</td>
                  <td className="p-3">{new Date(inv.issueDate).toLocaleDateString("pl-PL")}</td>
                  <td className="p-3">{inv.buyerName}</td>
                  <td className="p-3 text-right">{inv.grossAmount.toFixed(2)} {inv.currency}</td>
                  <td className="p-3">
                    {inv.ksefSentAt ? (
                      <span className="text-success">Wysłano</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => sendToKsef(inv.id)}
                        className="text-accent hover:underline"
                      >
                        Wyślij do KSEF
                      </button>
                    )}
                  </td>
                  <td className="p-3">
                    {inv.payment ? (
                      <span className="text-success">
                        Tak ({new Date(inv.payment.paidAt).toLocaleDateString("pl-PL")})
                      </span>
                    ) : (
                      <Link href="/dashboard/payments" className="text-muted hover:text-text">
                        Nie
                      </Link>
                    )}
                  </td>
                  <td className="p-3">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="text-accent hover:underline">
                      Szczegóły
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
