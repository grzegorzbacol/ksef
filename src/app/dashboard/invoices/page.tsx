"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MonthYearFilter } from "@/components/MonthYearFilter";

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

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const now = new Date();
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1);
  const [year, setYear] = useState<number | null>(now.getFullYear());

  const invoiceType = "sales" as const;

  function sourceLabel(source: string): string {
    switch (source) {
      case "ksef":
        return "KSEF";
      case "manual":
        return "Wprowadzona ręcznie";
      case "mail":
        return "Mail";
      default:
        return source || "—";
    }
  }

  function loadInvoices() {
    setLoading(true);
    const params = new URLSearchParams({ type: invoiceType, payment: "true" });
    if (month != null) params.set("month", String(month));
    if (year != null) params.set("year", String(year));
    fetch(`/api/invoices?${params}`)
      .then((r) => r.json())
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadInvoices();
  }, [month, year]);

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

  function updateLine(index: number, field: keyof InvoiceLine, value: string | number) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        if (field === "name" || field === "unit") return { ...l, [field]: String(value) };
        const numVal = typeof value === "string" ? parseFloat(value) : value;
        if (isNaN(numVal) || numVal < 0) return l;
        if (field === "vatRate" && numVal > 100) return l;
        if (field === "quantity" && numVal <= 0) return l;
        return { ...l, [field]: numVal };
      })
    );
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

  async function handleDelete(inv: Invoice) {
    if (!confirm(`Usunąć fakturę ${inv.number}?`)) return;
    setDeletingId(inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, { method: "DELETE" });
      if (!res.ok) alert("Błąd usuwania");
      else loadInvoices();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Faktury sprzedaży</h1>
        <div className="flex flex-wrap gap-3">
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
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div className="flex-shrink-0">
                <label className="block text-xs text-muted mb-1">Produkt</label>
                <select
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                  className="rounded border border-border bg-bg px-3 py-2 min-w-[200px] max-w-[280px]"
                >
                  <option value="">— wybierz —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} – {p.priceNet.toFixed(2)} {p.unit}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-shrink-0">
                <label className="block text-xs text-muted mb-1">Ilość</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="rounded border border-border bg-bg px-3 py-2 w-24 box-border"
                />
              </div>
              <button
                type="button"
                onClick={addLineFromWarehouse}
                disabled={!addProductId}
                className="rounded-lg border border-border px-4 py-2 hover:border-accent disabled:opacity-50 flex-shrink-0"
              >
                Dodaj do faktury
              </button>
            </div>
            {lines.length > 0 && (
              <div className="overflow-x-auto rounded border border-border mb-4">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col style={{ width: "auto" }} />
                    <col style={{ width: "100px" }} />
                    <col style={{ width: "100px" }} />
                    <col style={{ width: "72px" }} />
                    <col style={{ width: "80px" }} />
                    <col style={{ width: "80px" }} />
                    <col style={{ width: "56px" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border bg-bg/50">
                      <th className="p-2 text-left">Nazwa</th>
                      <th className="p-2 text-right">Ilość</th>
                      <th className="p-2 text-right">Cena netto</th>
                      <th className="p-2 text-right">VAT %</th>
                      <th className="p-2 text-right">Netto</th>
                      <th className="p-2 text-right">VAT</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="p-2 overflow-hidden text-ellipsis align-middle">{l.name}</td>
                        <td className="p-2 text-right align-middle whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={l.quantity}
                            onChange={(e) => updateLine(i, "quantity", e.target.value)}
                            className="w-16 rounded border border-border bg-bg px-2 py-1 text-right inline-block max-w-full"
                          />
                          <span className="ml-1">{l.unit}</span>
                        </td>
                        <td className="p-2 text-right align-middle">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={l.unitPriceNet}
                            onChange={(e) => updateLine(i, "unitPriceNet", e.target.value)}
                            className="w-full max-w-[88px] rounded border border-border bg-bg px-2 py-1 text-right box-border"
                            title="Cena netto za jednostkę – edytowalna"
                          />
                        </td>
                        <td className="p-2 text-right align-middle whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={l.vatRate}
                            onChange={(e) => updateLine(i, "vatRate", e.target.value)}
                            className="w-12 rounded border border-border bg-bg px-2 py-1 text-right inline-block max-w-full"
                          />
                          %
                        </td>
                        <td className="p-2 text-right align-middle">{(l.quantity * l.unitPriceNet).toFixed(2)}</td>
                        <td className="p-2 text-right align-middle">{(l.quantity * l.unitPriceNet * (l.vatRate / 100)).toFixed(2)}</td>
                        <td className="p-2 align-middle">
                          <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:underline whitespace-nowrap">
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

      <div className="mb-4">
        <MonthYearFilter month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </div>

      {loading ? (
        <p className="text-muted">Ładowanie…</p>
      ) : invoices.length === 0 ? (
        <p className="text-muted">Brak faktur sprzedaży. Dodaj pierwszą ręcznie.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="p-3 text-left">Numer</th>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Nabywca</th>
                <th className="p-3 text-right">Brutto</th>
                <th className="p-3">Źródło</th>
                <th className="p-3">KSEF</th>
                <th className="p-3">Rozliczono</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border">
                  <td className="p-3 font-medium">{inv.number}</td>
                  <td className="p-3">{new Date(inv.issueDate).toLocaleDateString("pl-PL")}</td>
                  <td className="p-3">{inv.buyerName}</td>
                  <td className="p-3 text-right">{inv.grossAmount.toFixed(2)} {inv.currency}</td>
                  <td className="p-3">{sourceLabel(inv.source)}</td>
                  <td className="p-3">
                    {inv.ksefSentAt ? (
                      <span className="text-success">Wysłano</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {inv.payment ? (
                      <span className="text-success">
                        Tak, {new Date(inv.payment.paidAt).toLocaleDateString("pl-PL")}
                      </span>
                    ) : (
                      <Link href="/dashboard/rozrachunki" className="text-muted hover:text-text">
                        Nie
                      </Link>
                    )}
                  </td>
                  <td className="p-3 flex gap-2">
                    <Link href={`/dashboard/invoices/${inv.id}`} className="text-accent hover:underline">
                      Szczegóły
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(inv)}
                      disabled={deletingId === inv.id}
                      className="text-red-400 hover:underline disabled:opacity-50"
                    >
                      Usuń
                    </button>
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
