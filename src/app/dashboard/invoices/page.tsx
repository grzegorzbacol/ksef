"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MonthYearFilter } from "@/components/MonthYearFilter";
import {
  Plus,
  Send,
  Printer,
  RefreshCw,
  Trash2,
  Search,
  FileText,
  Upload,
} from "lucide-react";

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
  ksefError: string | null;
  source: string;
  payment?: { paidAt: string } | null;
  correctionOfId?: string | null;
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
    saleDate: new Date().toISOString().slice(0, 10),
    paymentDueDays: "",
    paymentDueDate: "",
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
  const [syncKsefLoading, setSyncKsefLoading] = useState(false);
  const [sendingKsefId, setSendingKsefId] = useState<string | null>(null);
  const [importJpkLoading, setImportJpkLoading] = useState(false);

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
      case "jpk-fa":
        return "JPK FA";
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

  async function syncKsefStatus() {
    setSyncKsefLoading(true);
    try {
      const from =
        month != null && year != null
          ? `${year}-${String(month).padStart(2, "0")}-01`
          : new Date().toISOString().slice(0, 10);
      const to =
        month != null && year != null
          ? new Date(year, month, 0).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/ksef/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateFrom: from, dateTo: to }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        alert(data.error || "Błąd synchronizacji z KSeF");
        return;
      }
      const msg =
        data.updated > 0
          ? `Zaktualizowano: ${data.updated} faktur.${data.notFoundInKsef?.length ? ` Nie znaleziono w KSeF: ${data.notFoundInKsef.join(", ")}` : ""}`
          : "Synchronizacja zakończona. Brak zmian.";
      alert(msg);
      loadInvoices();
    } catch (e) {
      alert("Błąd: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncKsefLoading(false);
    }
  }

  async function handleImportJpkFa(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportJpkLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/invoices/import-jpk-fa", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Błąd importu pliku JPK_FA");
        return;
      }
      const msg =
        data.imported > 0
          ? `Zaimportowano: ${data.imported} faktur.${data.skipped ? ` Pominięto (istniejące): ${data.skipped}.` : ""}`
          : data.skipped > 0
            ? `Wszystkie faktury już istnieją (pominięto ${data.skipped}).`
            : "Brak faktur do importu.";
      if (data.errors?.length) alert(msg + "\nBłędy:\n" + data.errors.join("\n"));
      else alert(msg);
      loadInvoices();
    } catch (err) {
      alert("Błąd: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImportJpkLoading(false);
    }
  }

  async function resendToKsef(inv: Invoice) {
    setSendingKsefId(inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/ksef`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Błąd wysyłki do KSeF");
        return;
      }
      loadInvoices();
    } finally {
      setSendingKsefId(null);
    }
  }

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
      paymentDueDate: form.paymentDueDate || undefined,
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
      saleDate: new Date().toISOString().slice(0, 10),
      paymentDueDays: "",
      paymentDueDate: "",
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
        <h1 className="text-2xl font-bold text-content-text">Faktury sprzedaży</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <Plus className="w-4 h-4" />
            {showForm ? "Anuluj" : "Wystaw fakturę"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "#337ab7" }}
          >
            <Send className="w-4 h-4" />
            <Printer className="w-4 h-4" />
            Wyślij / drukuj
          </button>
          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50 ${importJpkLoading ? "cursor-not-allowed opacity-60" : ""}`}
            style={{ borderColor: "var(--content-border)", color: "var(--content-text)" }}
          >
            <input type="file" accept=".xml,application/xml,text/xml" className="sr-only" onChange={handleImportJpkFa} disabled={importJpkLoading} />
            <Upload className={`w-4 h-4 ${importJpkLoading ? "animate-pulse" : ""}`} />
            Import JPK FA
          </label>
          <button
            type="button"
            onClick={syncKsefStatus}
            disabled={syncKsefLoading}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-50"
            style={{ borderColor: "var(--content-border)", color: "var(--content-text)" }}
          >
            <RefreshCw className={`w-4 h-4 ${syncKsefLoading ? "animate-spin" : ""}`} />
            Sprawdź status w KSeF
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--danger)" }}
          >
            <Trash2 className="w-4 h-4" />
            Usuń zaznaczone
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 rounded-xl border bg-white p-6 space-y-4 shadow-sm" style={{ borderColor: "var(--content-border)" }}>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: "var(--accent)" }} />
            <h2 className="font-medium text-content-text">Nowa faktura sprzedaży</h2>
          </div>
          <p className="text-sm" style={{ color: "var(--content-text-secondary)" }}>Faktura sprzedaży – my jesteśmy sprzedawcą. Numer (FV/rok/numer) nadawany automatycznie.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>Data wystawienia</label>
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => {
                  const issueDate = e.target.value;
                  setForm((p) => {
                    const d = parseInt(p.paymentDueDays, 10);
                    let date = p.paymentDueDate;
                    if (!Number.isNaN(d) && d >= 0) {
                      const from = new Date(issueDate);
                      from.setDate(from.getDate() + d);
                      date = from.toISOString().slice(0, 10);
                    }
                    return { ...p, issueDate, paymentDueDate: date };
                  });
                }}
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>Liczba dni (od daty wystawienia)</label>
              <input
                type="number"
                min="0"
                placeholder="np. 14"
                value={form.paymentDueDays}
                onChange={(e) => {
                  const days = e.target.value;
                  setForm((p) => {
                    const d = parseInt(days, 10);
                    let date = "";
                    if (!Number.isNaN(d) && d >= 0) {
                      const from = new Date(p.issueDate);
                      from.setDate(from.getDate() + d);
                      date = from.toISOString().slice(0, 10);
                    }
                    return { ...p, paymentDueDays: days, paymentDueDate: date };
                  });
                }}
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
              />
              <p className="text-xs mt-0.5" style={{ color: "var(--content-text-secondary)" }}>Lub podaj datę poniżej</p>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>Termin płatności</label>
              <input
                type="date"
                value={form.paymentDueDate}
                onChange={(e) => setForm((p) => ({ ...p, paymentDueDate: e.target.value, paymentDueDays: "" }))}
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
              />
              <p className="text-xs mt-0.5" style={{ color: "var(--content-text-secondary)" }}>Wymagany przy wysyłce do KSeF</p>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>Data sprzedaży (opcjonalnie)</label>
              <input
                type="date"
                value={form.saleDate}
                onChange={(e) => setForm((p) => ({ ...p, saleDate: e.target.value }))}
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>Sprzedawca (nasza firma) – nazwa</label>
              <input
                value={form.sellerName}
                onChange={(e) => setForm((p) => ({ ...p, sellerName: e.target.value }))}
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>Sprzedawca – NIP</label>
              <input
                value={form.sellerNip}
                onChange={(e) => setForm((p) => ({ ...p, sellerNip: e.target.value }))}
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>Nabywca (kontrahent)</label>
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
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
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
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>Nabywca – nazwa</label>
              <input
                value={form.buyerName}
                onChange={(e) => setForm((p) => ({ ...p, buyerName: e.target.value }))}
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>Nabywca – NIP</label>
              <input
                value={form.buyerNip}
                onChange={(e) => setForm((p) => ({ ...p, buyerNip: e.target.value }))}
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
                required
              />
            </div>
          </div>
          <div className="border-t pt-4 mt-4" style={{ borderColor: "var(--content-border)" }}>
            <h3 className="font-medium mb-2 text-content-text">Pozycje z magazynu</h3>
            <p className="text-sm mb-3" style={{ color: "var(--content-text-secondary)" }}>Wybierz towar/usługę i ilość, aby dodać do faktury. Suma netto/VAT/brutto ustawi się automatycznie.</p>
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div className="flex-shrink-0">
                <label className="block text-xs mb-1" style={{ color: "var(--content-text-secondary)" }}>Produkt</label>
                <select
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                  className="rounded border border-content-border bg-white px-3 py-2 min-w-[200px] max-w-[280px]"
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
                <label className="block text-xs mb-1" style={{ color: "var(--content-text-secondary)" }}>Ilość</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="rounded border border-content-border bg-white px-3 py-2 w-24 box-border"
                />
              </div>
              <button
                type="button"
                onClick={addLineFromWarehouse}
                disabled={!addProductId}
                className="rounded-lg px-4 py-2 text-white hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                style={{ backgroundColor: "var(--accent)" }}
              >
                Dodaj do faktury
              </button>
            </div>
            {lines.length > 0 && (
              <div className="overflow-x-auto rounded border border-content-border mb-4">
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
                    <tr className="border-b bg-gray-50" style={{ borderColor: "var(--content-border)" }}>
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
                      <tr key={i} className="border-b" style={{ borderColor: "var(--content-border)" }}>
                        <td className="p-2 overflow-hidden text-ellipsis align-middle">{l.name}</td>
                        <td className="p-2 text-right align-middle whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={l.quantity}
                            onChange={(e) => updateLine(i, "quantity", e.target.value)}
                            className="w-16 rounded border border-content-border bg-white px-2 py-1 text-right inline-block max-w-full"
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
                            className="w-full max-w-[88px] rounded border border-content-border bg-white px-2 py-1 text-right box-border"
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
                            className="w-12 rounded border border-content-border bg-white px-2 py-1 text-right inline-block max-w-full"
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
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>Netto</label>
              <input
                type="number"
                step="0.01"
                value={lines.length > 0 ? totalsFromLines.net.toFixed(2) : form.netAmount}
                onChange={(e) => setForm((p) => ({ ...p, netAmount: e.target.value }))}
                readOnly={lines.length > 0}
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>VAT</label>
              <input
                type="number"
                step="0.01"
                value={lines.length > 0 ? totalsFromLines.vat.toFixed(2) : form.vatAmount}
                onChange={(e) => setForm((p) => ({ ...p, vatAmount: e.target.value }))}
                readOnly={lines.length > 0}
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>Brutto</label>
              <input
                type="number"
                step="0.01"
                value={lines.length > 0 ? totalsFromLines.gross.toFixed(2) : form.grossAmount}
                onChange={(e) => setForm((p) => ({ ...p, grossAmount: e.target.value }))}
                readOnly={lines.length > 0}
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--content-text-secondary)" }}>Waluta</label>
              <input
                value={form.currency}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                className="w-full rounded border border-content-border px-3 py-2 bg-white"
              />
            </div>
          </div>
          <button type="submit" className="rounded-lg px-4 py-2 text-white hover:opacity-90" style={{ backgroundColor: "var(--accent)" }}>
            Zapisz fakturę sprzedaży
          </button>
        </form>
      )}

      <div className="mb-4">
        <MonthYearFilter month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </div>

      <div className="mb-3 flex items-center justify-end gap-2">
        <button
          type="button"
          className="p-2 rounded-lg transition-colors hover:bg-gray-200"
          style={{ color: "var(--content-text-secondary)" }}
          title="Filtry"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8" style={{ color: "var(--content-text-secondary)" }}>
          <RefreshCw className="w-5 h-5 animate-spin" />
          Ładowanie…
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-xl border border-content-border bg-white p-12 text-center shadow-sm">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" style={{ color: "var(--content-text-secondary)" }} />
          <p className="text-content-text-secondary">Brak faktur sprzedaży. Dodaj pierwszą ręcznie.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-content-border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50" style={{ borderColor: "var(--content-border)" }}>
                <th className="p-3 text-left font-medium text-content-text">
                  <input type="checkbox" className="rounded border-content-border" />
                </th>
                <th className="p-3 text-left font-medium text-content-text">Numer</th>
                <th className="p-3 text-left font-medium text-content-text">Data wystaw.</th>
                <th className="p-3 text-left font-medium text-content-text">Kontrahent</th>
                <th className="p-3 text-right font-medium text-content-text">Netto</th>
                <th className="p-3 text-right font-medium text-content-text">Brutto</th>
                <th className="p-3 font-medium text-content-text">Źródło</th>
                <th className="p-3 font-medium text-content-text">KSEF</th>
                <th className="p-3 font-medium text-content-text">Status</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b transition-colors hover:bg-gray-50/80" style={{ borderColor: "var(--content-border)" }}>
                  <td className="p-3">
                    <input type="checkbox" className="rounded border-content-border" />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/invoices/${inv.id}`} className="font-medium text-content-text hover:underline flex items-center gap-1.5">
                        <Search className="w-4 h-4 opacity-60" />
                        {inv.number}
                      </Link>
                      {inv.correctionOfId && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Korekta
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-content-text">{new Date(inv.issueDate).toLocaleDateString("pl-PL")}</td>
                  <td className="p-3 text-content-text">{inv.buyerName}</td>
                  <td className="p-3 text-right text-content-text">{(inv.netAmount ?? 0).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</td>
                  <td className="p-3 text-right text-content-text font-medium">{inv.grossAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} {inv.currency}</td>
                  <td className="p-3 text-content-text-secondary">{sourceLabel(inv.source)}</td>
                  <td className="p-3">
                    {inv.ksefId && inv.ksefStatus !== "not_in_ksef" ? (
                      <span className="text-success font-medium" title={inv.ksefId ?? undefined}>
                        W KSeF ✓
                      </span>
                    ) : inv.ksefStatus === "not_in_ksef" ? (
                      <span className="flex flex-col gap-1">
                        <span className="text-amber-600 text-xs font-medium">Nie w KSeF</span>
                        <button
                          type="button"
                          onClick={() => resendToKsef(inv)}
                          disabled={sendingKsefId === inv.id}
                          className="text-xs text-accent hover:underline text-left disabled:opacity-50"
                        >
                          {sendingKsefId === inv.id ? "Wysyłanie…" : "Wyślij ponownie"}
                        </button>
                      </span>
                    ) : inv.ksefError ? (
                      <span className="flex flex-col gap-1">
                        <span className="text-red-600 text-xs max-w-[200px] truncate block" title={inv.ksefError}>
                          Błąd: {inv.ksefError}
                        </span>
                        <button
                          type="button"
                          onClick={() => resendToKsef(inv)}
                          disabled={sendingKsefId === inv.id}
                          className="text-xs text-accent hover:underline text-left disabled:opacity-50"
                        >
                          {sendingKsefId === inv.id ? "Wysyłanie…" : "Wyślij ponownie"}
                        </button>
                      </span>
                    ) : (
                      <span className="text-content-text-secondary">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {inv.payment ? (
                      <div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: "var(--success)" }}>
                          Opłacono
                        </span>
                        <p className="text-xs mt-0.5" style={{ color: "var(--content-text-secondary)" }}>
                          {new Date(inv.payment.paidAt).toLocaleDateString("pl-PL")}
                        </p>
                      </div>
                    ) : (
                      <Link href="/dashboard/rozrachunki" className="text-content-text-secondary hover:text-accent transition-colors">
                        Nie rozliczono
                      </Link>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/dashboard/invoices/${inv.id}`}
                        className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                        style={{ color: "var(--accent)" }}
                        title="Szczegóły"
                      >
                        <Search className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(inv)}
                        disabled={deletingId === inv.id}
                        className="p-1.5 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                        style={{ color: "var(--danger)" }}
                        title="Usuń"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
