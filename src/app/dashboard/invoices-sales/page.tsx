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

type Product = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  priceNet: number;
  vatRate: number;
};

type Contractor = {
  id: string;
  name: string;
  nip: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
};

type InvoiceLine = {
  productId?: string;
  name: string;
  quantity: number;
  unit: string;
  unitPriceNet: number;
  vatRate: number;
};

export default function InvoicesSalesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchKsefLoading, setFetchKsefLoading] = useState(false);
  const [fetchRange, setFetchRange] = useState({ from: "", to: "" });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
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
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("1");

  const invoiceType = "sales" as const;

  function loadInvoices() {
    setLoading(true);
    fetch(`/api/invoices?type=${invoiceType}&payment=true`)
      .then((r) => r.json())
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    if (showForm) {
      fetch("/api/products").then((r) => r.json()).then(setProducts).catch(() => setProducts([]));
      fetch("/api/contractors").then((r) => r.json()).then((data) => setContractors(Array.isArray(data) ? data : [])).catch(() => setContractors([]));
      fetch("/api/settings/company")
        .then((r) => r.json())
        .then((company: { name?: string; nip?: string }) => {
          if (company?.name || company?.nip) {
            setForm((f) => ({
              ...f,
              sellerName: company.name ?? f.sellerName,
              sellerNip: company.nip ?? f.sellerNip,
            }));
          }
        })
        .catch(() => {});
    }
  }, [showForm]);

  function addLineFromWarehouse() {
    const product = products.find((p) => p.id === addProductId);
    if (!product) return;
    const qty = parseFloat(addQty) || 1;
    if (qty <= 0) return;
    setLines((prev) => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        quantity: qty,
        unit: product.unit,
        unitPriceNet: product.priceNet,
        vatRate: product.vatRate,
      },
    ]);
    setAddProductId("");
    setAddQty("1");
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const totalsFromLines = (() => {
    let net = 0, vat = 0;
    for (const l of lines) {
      const lineNet = l.quantity * l.unitPriceNet;
      net += lineNet;
      vat += lineNet * (l.vatRate / 100);
    }
    return { net, vat, gross: net + vat };
  })();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const net = parseFloat(form.netAmount) || 0;
    const vat = parseFloat(form.vatAmount) || 0;
    const gross = parseFloat(form.grossAmount) || net + vat;
    const payload: Record<string, unknown> = {
      type: invoiceType,
      issueDate: form.issueDate,
      saleDate: form.saleDate || undefined,
      sellerName: form.sellerName,
      sellerNip: form.sellerNip,
      buyerName: form.buyerName,
      buyerNip: form.buyerNip,
      netAmount: lines.length > 0 ? totalsFromLines.net : net,
      vatAmount: lines.length > 0 ? totalsFromLines.vat : vat,
      grossAmount: lines.length > 0 ? totalsFromLines.gross : gross,
      currency: form.currency,
    };
    if (lines.length > 0) payload.items = lines;
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Błąd zapisu");
      return;
    }
    setShowForm(false);
    setLines([]);
    setForm({
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
    if (!res.ok || data.ok === false) alert(data.error || "Błąd pobierania z KSEF");
    else {
      alert(`Zaimportowano: ${data.imported ?? 0} faktur.`);
      loadInvoices();
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Faktury sprzedaży</h1>
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
            {showForm ? "Anuluj" : "Nowa faktura sprzedaży"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-medium">Nowa faktura sprzedaży</h2>
          <p className="text-muted text-sm">Faktura sprzedaży – my jesteśmy sprzedawcą. Numer (FV/rok/numer) nadawany automatycznie.</p>
          <div className="grid gap-4 sm:grid-cols-2">
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
              <label className="block text-sm text-muted mb-1">Sprzedawca (nasza firma) – nazwa</label>
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
            <div className="sm:col-span-2">
              <label className="block text-sm text-muted mb-1">Nabywca (kontrahent)</label>
              <select
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const c = contractors.find((x) => x.id === id);
                  if (c) {
                    setForm((p) => ({ ...p, buyerName: c.name, buyerNip: c.nip }));
                  }
                  e.target.value = "";
                }}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              >
                <option value="">— wybierz nabywcę z bazy kontrahentów —</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.nip})
                  </option>
                ))}
              </select>
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
          <div className="border-t border-border pt-4 mt-4">
            <h3 className="font-medium mb-2">Pozycje z magazynu</h3>
            <p className="text-muted text-sm mb-3">Wybierz towar/usługę i ilość, aby dodać do faktury. Suma netto/VAT/brutto ustawi się automatycznie.</p>
            <div className="flex flex-wrap gap-2 items-end mb-4">
              <div>
                <label className="block text-xs text-muted mb-1">Produkt</label>
                <select
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                  className="rounded border border-border bg-bg px-3 py-2 min-w-[200px]"
                >
                  <option value="">— wybierz —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} – {p.priceNet.toFixed(2)} {p.unit}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Ilość</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="rounded border border-border bg-bg px-3 py-2 w-24"
                />
              </div>
              <button
                type="button"
                onClick={addLineFromWarehouse}
                disabled={!addProductId}
                className="rounded-lg border border-border px-4 py-2 hover:border-accent disabled:opacity-50"
              >
                Dodaj do faktury
              </button>
            </div>
            {lines.length > 0 && (
              <div className="overflow-x-auto rounded border border-border mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg/50">
                      <th className="p-2 text-left">Nazwa</th>
                      <th className="p-2 text-right">Ilość</th>
                      <th className="p-2 text-right">Cena netto</th>
                      <th className="p-2 text-right">VAT %</th>
                      <th className="p-2 text-right">Netto</th>
                      <th className="p-2 text-right">VAT</th>
                      <th className="p-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="p-2">{l.name}</td>
                        <td className="p-2 text-right">{l.quantity} {l.unit}</td>
                        <td className="p-2 text-right">{l.unitPriceNet.toFixed(2)}</td>
                        <td className="p-2 text-right">{l.vatRate}%</td>
                        <td className="p-2 text-right">{(l.quantity * l.unitPriceNet).toFixed(2)}</td>
                        <td className="p-2 text-right">{(l.quantity * l.unitPriceNet * (l.vatRate / 100)).toFixed(2)}</td>
                        <td className="p-2">
                          <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:underline">
                            Usuń
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="p-2 text-right text-sm">
                  Razem netto: <strong>{totalsFromLines.net.toFixed(2)}</strong> &nbsp;
                  VAT: <strong>{totalsFromLines.vat.toFixed(2)}</strong> &nbsp;
                  Brutto: <strong>{totalsFromLines.gross.toFixed(2)}</strong> {form.currency}
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-sm text-muted mb-1">Netto</label>
              <input
                type="number"
                step="0.01"
                value={lines.length > 0 ? totalsFromLines.net.toFixed(2) : form.netAmount}
                onChange={(e) => setForm((p) => ({ ...p, netAmount: e.target.value }))}
                readOnly={lines.length > 0}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">VAT</label>
              <input
                type="number"
                step="0.01"
                value={lines.length > 0 ? totalsFromLines.vat.toFixed(2) : form.vatAmount}
                onChange={(e) => setForm((p) => ({ ...p, vatAmount: e.target.value }))}
                readOnly={lines.length > 0}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Brutto</label>
              <input
                type="number"
                step="0.01"
                value={lines.length > 0 ? totalsFromLines.gross.toFixed(2) : form.grossAmount}
                onChange={(e) => setForm((p) => ({ ...p, grossAmount: e.target.value }))}
                readOnly={lines.length > 0}
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
            Zapisz fakturę sprzedaży
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-muted">Ładowanie…</p>
      ) : invoices.length === 0 ? (
        <p className="text-muted">Brak faktur sprzedaży. Dodaj pierwszą lub pobierz z KSEF.</p>
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
