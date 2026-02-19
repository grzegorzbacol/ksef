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
  vatDeductionPercent?: number | null;
  costDeductionPercent?: number | null;
  expenseType?: string;
  carId?: string | null;
  car?: Car | null;
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
  const PURCHASE_VAT_RATES = [0.8, 23] as const;
  const [manualLine, setManualLine] = useState({ name: "", quantity: "1", unit: "szt.", unitPriceNet: "", vatRate: "23" });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingPaidId, setTogglingPaidId] = useState<string | null>(null);
  const [assigningContractorId, setAssigningContractorId] = useState<string | null>(null);
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState("");
  const [savingAmountId, setSavingAmountId] = useState<string | null>(null);
  const [editingNumberId, setEditingNumberId] = useState<string | null>(null);
  const [editingNumberValue, setEditingNumberValue] = useState("");
  const [savingNumberId, setSavingNumberId] = useState<string | null>(null);
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [editingSellerName, setEditingSellerName] = useState("");
  const [editingSellerNip, setEditingSellerNip] = useState("");
  const [savingSellerId, setSavingSellerId] = useState<string | null>(null);
  const [companyTax, setCompanyTax] = useState<{
    pitRate: number;
    healthRate: number;
    isVatPayer: boolean;
  } | null>(null);
  const [cars, setCars] = useState<Car[]>([]);
  const [expenseType, setExpenseType] = useState<"standard" | "car">("standard");
  const [expenseCarId, setExpenseCarId] = useState("");
  const [customVatRowIndex, setCustomVatRowIndex] = useState<number | null>(null);
  const now = new Date();
  const [month, setMonth] = useState<number | null>(now.getMonth() + 1);
  const [year, setYear] = useState<number | null>(now.getFullYear());

  const invoiceType = "cost" as const;
  const taxConfig = companyTax ?? { pitRate: 0.12, healthRate: 0.09, isVatPayer: true };

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

function InvoiceNumberCell({
  invoiceId,
  invoiceNumber,
  onError,
  label,
}: {
  invoiceId: string;
  invoiceNumber: string;
  onError: (msg: string) => void;
  /** Gdy podane, przycisk wyświetla tę etykietę zamiast numeru (np. "Pobierz") */
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  async function handleDownload(e: React.MouseEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/download`, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Nie udało się pobrać pliku faktury.";
        try {
          const data = JSON.parse(text);
          if (data?.error) msg = data.error;
        } catch {
          if (text) msg = text.slice(0, 200);
        }
        onError(msg);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      let filename = `Faktura_${invoiceNumber.replace(/\//g, "-")}.pdf`;
      if (disposition) {
        const match = /filename="?([^";\n]+)"?/.exec(disposition);
        if (match?.[1]) filename = match[1].trim();
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      onError("Nie udało się pobrać pliku faktury.");
    } finally {
      setLoading(false);
    }
  }
  const displayText = label ?? invoiceNumber;
  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="font-medium text-left text-accent hover:underline disabled:opacity-70"
      title={label ? "Pobierz plik faktury" : undefined}
    >
      {loading ? "Pobieranie…" : displayText}
    </button>
  );
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
    fetch("/api/settings/company")
      .then((r) => r.json())
      .then((data: { pitRate?: number; healthRate?: number; isVatPayer?: boolean | string }) => {
        setCompanyTax({
          pitRate: data?.pitRate != null ? Number(data.pitRate) : 0.12,
          healthRate: data?.healthRate != null ? Number(data.healthRate) : 0.09,
          isVatPayer: data?.isVatPayer !== false && String(data?.isVatPayer) !== "false",
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/cars")
      .then((r) => r.json())
      .then((data) => setCars(Array.isArray(data) ? data : []))
      .catch(() => setCars([]));
  }, []);

  useEffect(() => {
    fetch("/api/contractors")
      .then((r) => r.json())
      .then((data) => setContractors(Array.isArray(data) ? data : []))
      .catch(() => setContractors([]));
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
              buyerName: company.name ?? f.buyerName,
              buyerNip: company.nip ?? f.buyerNip,
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

  function addManualLine() {
    const name = manualLine.name.trim();
    if (!name) return;
    const qty = parseFloat(manualLine.quantity) || 1;
    if (qty <= 0) return;
    const unitPriceNet = parseFloat(manualLine.unitPriceNet);
    if (isNaN(unitPriceNet) || unitPriceNet < 0) return;
    const vatRate = parseFloat(manualLine.vatRate);
    if (isNaN(vatRate) || vatRate < 0 || vatRate > 100) return;
    setLines((prev) => [
      ...prev,
      {
        name,
        quantity: qty,
        unit: manualLine.unit.trim() || "szt.",
        unitPriceNet,
        vatRate,
      },
    ]);
    setManualLine({ name: "", quantity: "1", unit: "szt.", unitPriceNet: "", vatRate: "23" });
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
      expenseType: expenseType === "car" && expenseCarId ? "car" : "standard",
      carId: expenseType === "car" && expenseCarId ? expenseCarId : null,
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
    const created = await res.json();
    if (attachmentFile) {
      const fd = new FormData();
      fd.append("file", attachmentFile);
      const attRes = await fetch(`/api/invoices/${created.id}/attachments`, {
        method: "POST",
        body: fd,
      });
      if (!attRes.ok) {
        const d = await attRes.json().catch(() => ({}));
        alert(`Faktura zapisana, ale załącznik nie został dodany: ${d.error || "błąd"}`);
      }
    }
    setShowForm(false);
    setLines([]);
    setCustomVatRowIndex(null);
    setManualLine({ name: "", quantity: "1", unit: "szt.", unitPriceNet: "", vatRate: "23" });
    setAttachmentFile(null);
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
    setExpenseType("standard");
    setExpenseCarId("");
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

  async function togglePaid(inv: Invoice) {
    setTogglingPaidId(inv.id);
    try {
      const res = await fetch("/api/payments/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: inv.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error || "Błąd");
      else loadInvoices();
    } finally {
      setTogglingPaidId(null);
    }
  }

  async function saveAmount(invoiceId: string, valueStr: string) {
    const num = parseFloat(valueStr.replace(",", "."));
    if (Number.isNaN(num) || num < 0) {
      setEditingAmountId(null);
      return;
    }
    setSavingAmountId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grossAmount: num }),
      });
      if (!res.ok) alert("Błąd zapisu kwoty");
      else loadInvoices();
    } finally {
      setSavingAmountId(null);
      setEditingAmountId(null);
    }
  }

  async function saveNumber(invoiceId: string, valueStr: string) {
    const num = valueStr.trim();
    if (!num) {
      setEditingNumberId(null);
      return;
    }
    setSavingNumberId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: num }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Błąd zapisu numeru");
        return;
      }
      loadInvoices();
    } finally {
      setSavingNumberId(null);
      setEditingNumberId(null);
    }
  }

  async function saveSeller(invoiceId: string, name: string, nip: string) {
    const trimmedName = name.trim();
    const trimmedNip = nip.trim().replace(/\s/g, "");
    setSavingSellerId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerName: trimmedName, sellerNip: trimmedNip }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Błąd zapisu dostawcy");
        return;
      }
      loadInvoices();
    } finally {
      setSavingSellerId(null);
      setEditingSellerId(null);
    }
  }

  async function assignContractor(inv: Invoice, contractorId: string) {
    const c = contractors.find((x) => x.id === contractorId);
    if (!c) return;
    setAssigningContractorId(inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerName: c.name, sellerNip: c.nip }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Błąd zapisu");
        return;
      }
      loadInvoices();
    } finally {
      setAssigningContractorId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Faktury zakupu</h1>
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
            {showForm ? "Anuluj" : "Nowa faktura zakupu"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-medium">Nowa faktura zakupu</h2>
          <p className="text-muted text-sm">Faktura zakupu – Ty jesteś nabywcą (płacisz dostawcy). Numer (FK/rok/numer) nadawany automatycznie. Faktury trafiają od razu do rozrachunków. Możesz wpisać dane ręcznie, dodać pozycje z magazynu lub ręcznie (nazwa, ilość, cena, VAT) oraz załączyć plik (np. skan faktury).</p>
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
            <div className="sm:col-span-2">
              <label className="block text-sm text-muted mb-1">Dostawca (sprzedawca)</label>
              <select
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const c = contractors.find((x) => x.id === id);
                  if (c) {
                    setForm((p) => ({ ...p, sellerName: c.name, sellerNip: c.nip }));
                  }
                  e.target.value = "";
                }}
                className="w-full rounded border border-border bg-bg px-3 py-2"
              >
                <option value="">— wybierz dostawcę z bazy kontrahentów —</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.nip})
                  </option>
                ))}
              </select>
            </div>
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
              <label className="block text-sm text-muted mb-1">Nabywca (nasza firma) – nazwa</label>
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
            <h3 className="font-medium mb-2">Typ wydatku</h3>
            <p className="text-muted text-sm mb-2">Oznacz, czy to wydatek standardowy, czy związany z samochodem (korzyści podatkowe będą liczone według limitów i VAT dla pojazdu).</p>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="expenseType"
                  checked={expenseType === "standard"}
                  onChange={() => { setExpenseType("standard"); setExpenseCarId(""); }}
                  className="rounded border-border"
                />
                <span>Standardowy</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="expenseType"
                  checked={expenseType === "car"}
                  onChange={() => setExpenseType("car")}
                  className="rounded border-border"
                />
                <span>Samochód:</span>
              </label>
              <select
                value={expenseCarId}
                onChange={(e) => setExpenseCarId(e.target.value)}
                disabled={expenseType !== "car"}
                className="rounded border border-border bg-bg px-3 py-2 min-w-[180px] disabled:opacity-50"
              >
                <option value="">— wybierz samochód —</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {cars.length === 0 && expenseType === "car" && (
              <p className="text-muted text-xs mt-1">
                <Link href="/dashboard/settings" className="text-accent hover:underline">Dodaj samochody w Ustawieniach</Link>.
              </p>
            )}
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
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <span className="text-muted text-sm self-center flex-shrink-0">lub pozycja ręczna:</span>
              <div className="flex-shrink-0">
                <label className="block text-xs text-muted mb-1">Nazwa</label>
                <input
                  type="text"
                  value={manualLine.name}
                  onChange={(e) => setManualLine((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nazwa towaru/usługi"
                  className="rounded border border-border bg-bg px-3 py-2 min-w-[140px] max-w-[200px] box-border"
                />
              </div>
              <div className="flex-shrink-0">
                <label className="block text-xs text-muted mb-1">Ilość</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={manualLine.quantity}
                  onChange={(e) => setManualLine((p) => ({ ...p, quantity: e.target.value }))}
                  className="rounded border border-border bg-bg px-3 py-2 w-20 box-border"
                />
              </div>
              <div className="flex-shrink-0">
                <label className="block text-xs text-muted mb-1">j.m.</label>
                <input
                  type="text"
                  value={manualLine.unit}
                  onChange={(e) => setManualLine((p) => ({ ...p, unit: e.target.value }))}
                  placeholder="szt."
                  className="rounded border border-border bg-bg px-3 py-2 w-16 box-border"
                />
              </div>
              <div className="flex-shrink-0">
                <label className="block text-xs text-muted mb-1">Cena netto</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualLine.unitPriceNet}
                  onChange={(e) => setManualLine((p) => ({ ...p, unitPriceNet: e.target.value }))}
                  className="rounded border border-border bg-bg px-3 py-2 w-24 box-border"
                />
              </div>
              <div className="flex-shrink-0">
                <label className="block text-xs text-muted mb-1">VAT %</label>
                <select
                  value={PURCHASE_VAT_RATES.includes(parseFloat(manualLine.vatRate) as 0.8 | 23) ? manualLine.vatRate : "other"}
                  onChange={(e) => setManualLine((p) => ({ ...p, vatRate: e.target.value === "other" ? "" : e.target.value }))}
                  className="rounded border border-border bg-bg px-3 py-2 w-20 box-border"
                >
                  {PURCHASE_VAT_RATES.map((r) => (
                    <option key={r} value={String(r)}>{r}%</option>
                  ))}
                  <option value="other">Inna</option>
                </select>
                {manualLine.vatRate === "" || !PURCHASE_VAT_RATES.includes(parseFloat(manualLine.vatRate) as 0.8 | 23) ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={manualLine.vatRate}
                    onChange={(e) => setManualLine((p) => ({ ...p, vatRate: e.target.value }))}
                    placeholder="%"
                    className="rounded border border-border bg-bg px-2 py-1 w-14 mt-1 box-border text-sm"
                  />
                ) : null}
              </div>
              <button
                type="button"
                onClick={addManualLine}
                disabled={!manualLine.name.trim()}
                className="rounded-lg border border-border px-4 py-2 hover:border-accent disabled:opacity-50 flex-shrink-0"
              >
                Dodaj pozycję ręcznie
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
                          <select
                            value={
                              customVatRowIndex === i || !PURCHASE_VAT_RATES.includes(l.vatRate as 0.8 | 23)
                                ? "other"
                                : String(l.vatRate)
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "other") setCustomVatRowIndex(i);
                              else {
                                setCustomVatRowIndex((prev) => (prev === i ? null : prev));
                                updateLine(i, "vatRate", parseFloat(v));
                              }
                            }}
                            className="w-16 rounded border border-border bg-bg px-2 py-1 text-right inline-block max-w-full"
                          >
                            {PURCHASE_VAT_RATES.map((r) => (
                              <option key={r} value={String(r)}>{r}%</option>
                            ))}
                            <option value="other">Inna…</option>
                          </select>
                          {(customVatRowIndex === i || !PURCHASE_VAT_RATES.includes(l.vatRate as 0.8 | 23)) && (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              value={l.vatRate}
                              onChange={(e) => updateLine(i, "vatRate", e.target.value)}
                              onBlur={() => setCustomVatRowIndex((prev) => (prev === i ? null : prev))}
                              className="w-14 rounded border border-border bg-bg px-2 py-1 text-right inline-block mt-1"
                            />
                          )}
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
          <div className="border-t border-border pt-4">
            <label className="block text-sm text-muted mb-1">Załącznik (opcjonalnie)</label>
            <input
              type="file"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
              className="w-full max-w-md text-sm text-muted file:mr-3 file:rounded file:border-0 file:bg-accent file:px-4 file:py-2 file:text-white file:hover:opacity-90"
            />
            {attachmentFile && (
              <p className="text-sm text-muted mt-1">
                Wybrany plik: {attachmentFile.name}
              </p>
            )}
          </div>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90">
            Zapisz fakturę zakupu
          </button>
        </form>
      )}

      <div className="mb-4">
        <MonthYearFilter month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </div>

      {loading ? (
        <p className="text-muted">Ładowanie…</p>
      ) : invoices.length === 0 ? (
        <p className="text-muted">Brak faktur zakupu. Pobierz z KSEF lub dodaj ręcznie. Faktury trafiają od razu do rozrachunków.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="p-3 text-left">Numer</th>
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Dostawca</th>
                <th className="p-3 text-left">Typ wydatku</th>
                <th className="p-3 text-right">Brutto</th>
                <th className="p-3 text-right">Realny koszt</th>
                <th className="p-3">Źródło</th>
                <th className="p-3">Rozliczono</th>
                <th className="p-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const taxResult = computePurchaseInvoiceTaxBenefit(
                  {
                    grossAmount: inv.grossAmount,
                    netAmount: inv.netAmount,
                    vatAmount: inv.vatAmount,
                    vatDeductionPercent: inv.vatDeductionPercent ?? 1,
                    costDeductionPercent: inv.costDeductionPercent ?? 1,
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
                  taxConfig
                );
                return (
                <tr key={inv.id} className="border-b border-border">
                  <td className="p-3">
                    {inv.source === "mail" ? (
                      editingNumberId === inv.id ? (
                        <input
                          type="text"
                          value={editingNumberValue}
                          onChange={(e) => setEditingNumberValue(e.target.value)}
                          onBlur={() => {
                            if (editingNumberId === inv.id) saveNumber(inv.id, editingNumberValue);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") {
                              setEditingNumberId(null);
                              setEditingNumberValue("");
                            }
                          }}
                          disabled={savingNumberId === inv.id}
                          autoFocus
                          className="w-full max-w-[140px] rounded border border-border bg-bg px-2 py-1 text-sm font-medium"
                        />
                      ) : (
                        <span className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNumberId(inv.id);
                              setEditingNumberValue(inv.number);
                            }}
                            title="Kliknij, aby edytować numer faktury"
                            className="font-medium text-left rounded px-1 py-0.5 text-accent hover:bg-bg/80 hover:underline focus:outline-none focus:ring-1 focus:ring-accent"
                          >
                            {inv.number}
                          </button>
                          <InvoiceNumberCell
                            invoiceId={inv.id}
                            invoiceNumber={inv.number}
                            onError={(msg) => alert(msg)}
                            label="Pobierz"
                          />
                        </span>
                      )
                    ) : (
                      <InvoiceNumberCell
                        invoiceId={inv.id}
                        invoiceNumber={inv.number}
                        onError={(msg) => alert(msg)}
                      />
                    )}
                  </td>
                  <td className="p-3">{new Date(inv.issueDate).toLocaleDateString("pl-PL")}</td>
                  <td className="p-3">
                    <div className="space-y-1">
                      {inv.source !== "ksef" && editingSellerId === inv.id ? (
                        <div className="space-y-1 max-w-[220px]">
                          <input
                            type="text"
                            value={editingSellerName}
                            onChange={(e) => setEditingSellerName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                saveSeller(inv.id, editingSellerName, editingSellerNip);
                              }
                              if (e.key === "Escape") {
                                setEditingSellerId(null);
                              }
                            }}
                            placeholder="Nazwa dostawcy"
                            disabled={savingSellerId === inv.id}
                            autoFocus
                            className="block w-full rounded border border-border bg-bg px-2 py-1 text-xs"
                          />
                          <input
                            type="text"
                            value={editingSellerNip}
                            onChange={(e) => setEditingSellerNip(e.target.value)}
                            onBlur={() => saveSeller(inv.id, editingSellerName, editingSellerNip)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveSeller(inv.id, editingSellerName, editingSellerNip);
                              if (e.key === "Escape") setEditingSellerId(null);
                            }}
                            placeholder="NIP"
                            disabled={savingSellerId === inv.id}
                            className="block w-full rounded border border-border bg-bg px-2 py-1 text-xs"
                          />
                        </div>
                      ) : (
                        <>
                          {inv.source !== "ksef" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSellerId(inv.id);
                                setEditingSellerName(inv.sellerName);
                                setEditingSellerNip(inv.sellerNip ?? "");
                              }}
                              title="Kliknij, aby edytować dostawcę"
                              className="text-left rounded px-1 py-0.5 text-accent hover:bg-bg/80 hover:underline focus:outline-none focus:ring-1 focus:ring-accent block"
                            >
                              {inv.sellerName}
                            </button>
                          ) : (
                            <span>{inv.sellerName}</span>
                          )}
                          {inv.source !== "ksef" && contractors.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v) assignContractor(inv, v);
                                e.target.value = "";
                              }}
                              disabled={assigningContractorId === inv.id}
                              className="block w-full max-w-[200px] rounded border border-border bg-bg px-2 py-1 text-xs text-muted disabled:opacity-50"
                              title="Przypisz kontrahenta z bazy"
                            >
                              <option value="">— przypisz kontrahenta —</option>
                              {contractors.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.nip})
                                </option>
                              ))}
                            </select>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-muted text-sm">
                    {inv.expenseType === "car" && inv.car ? inv.car.name : "Standardowy"}
                  </td>
                  <td className="p-3 text-right">
                    {editingAmountId === inv.id ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editingAmountValue}
                          onChange={(e) => setEditingAmountValue(e.target.value)}
                          onBlur={() => {
                            if (editingAmountId === inv.id) saveAmount(inv.id, editingAmountValue);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") {
                              setEditingAmountId(null);
                              setEditingAmountValue("");
                            }
                          }}
                          disabled={savingAmountId === inv.id}
                          autoFocus
                          className="w-24 rounded border border-border bg-bg px-2 py-1 text-right text-sm"
                        />
                        <span className="text-muted text-sm">{inv.currency}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAmountId(inv.id);
                          setEditingAmountValue(inv.grossAmount.toFixed(2));
                        }}
                        title="Kliknij, aby szybko edytować kwotę (np. ZUS, US)"
                        className="rounded px-1 py-0.5 text-right hover:bg-bg/80 focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        {inv.grossAmount.toFixed(2)} {inv.currency}
                      </button>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {taxResult.realCost.toFixed(2)} {inv.currency}
                  </td>
                  <td className="p-3">{sourceLabel(inv.source)}</td>
                  <td className="p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!inv.payment}
                        disabled={togglingPaidId === inv.id}
                        onChange={() => togglePaid(inv)}
                        className="h-4 w-4 rounded border-border bg-bg text-accent focus:ring-accent"
                        title="Oznacz jako opłaconą"
                      />
                      {inv.payment ? (
                        <span className="text-success text-sm">
                          Tak, {new Date(inv.payment.paidAt).toLocaleDateString("pl-PL")}
                        </span>
                      ) : (
                        <span className="text-muted text-sm">Nie</span>
                      )}
                    </label>
                  </td>
                  <td className="p-3 flex gap-2">
                    <Link href={`/dashboard/invoices-sales/${inv.id}`} className="text-accent hover:underline">
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
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
