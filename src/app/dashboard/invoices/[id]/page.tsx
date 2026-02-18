"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

function DownloadPdfButton({
  invoiceId,
  invoiceNumber,
  ksefId,
}: {
  invoiceId: string;
  invoiceNumber: string;
  ksefId: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const hasKsefId = !!ksefId?.trim();
  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Nie udało się pobrać PDF z KSEF.";
        try {
          const data = JSON.parse(text);
          if (data?.error) msg = data.error;
        } catch {
          if (text) msg = text.slice(0, 200);
        }
        alert(msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Faktura_${invoiceNumber.replace(/\//g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Nie udało się pobrać PDF z KSEF.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading || !hasKsefId}
      title={!hasKsefId ? "PDF tylko z KSEF. Pobierz tę fakturę z KSEF (lista faktur → Pobierz z KSEF), aby mieć numer KSEF." : undefined}
      className="rounded bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
    >
      {loading ? "Pobieranie…" : "Pobierz PDF z KSEF"}
    </button>
  );
}

type InvoiceItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPriceNet: number;
  vatRate: number;
  amountNet: number;
  amountVat: number;
};

type EmailAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

type Invoice = {
  id: string;
  type?: string;
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
  paymentDueDate?: string | null;
  recurringCode?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  emailFrom?: string | null;
  emailReceivedAt?: string | null;
  payment?: { paidAt: string } | null;
  items?: InvoiceItem[];
  emailAttachments?: EmailAttachment[];
};

type Contractor = {
  id: string;
  name: string;
  nip: string;
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAmount, setSavingAmount] = useState(false);
  const [savingContractor, setSavingContractor] = useState(false);
  const [togglingPaid, setTogglingPaid] = useState(false);
  const [editNet, setEditNet] = useState("");
  const [editVat, setEditVat] = useState("");
  const [editGross, setEditGross] = useState("");

  function loadInvoice() {
    return fetch(`/api/invoices/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((inv) => {
        setInvoice(inv);
        if (inv) {
          setEditNet(String(inv.netAmount ?? 0));
          setEditVat(String(inv.vatAmount ?? 0));
          setEditGross(String(inv.grossAmount ?? 0));
        }
      });
  }

  useEffect(() => {
    loadInvoice().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (invoice?.type === "cost") {
      fetch("/api/contractors")
        .then((r) => r.json())
        .then((data) => setContractors(Array.isArray(data) ? data : []))
        .catch(() => setContractors([]));
    }
  }, [invoice?.type]);

  if (loading) return <p className="text-muted">Ładowanie…</p>;
  if (!invoice) return <p className="text-muted">Nie znaleziono faktury.</p>;

  const isCost = invoice.type === "cost";
  const listHref = isCost ? "/dashboard/rozrachunki" : "/dashboard/invoices";
  const typeLabel = isCost ? "Faktura kosztowa" : "Faktura sprzedaży";

  return (
    <div>
      <div className="mb-4">
        <Link href={listHref} className="text-accent hover:underline">← {isCost ? "Rozrachunki" : "Lista faktur sprzedaży"}</Link>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h1 className="text-xl font-semibold">{typeLabel} {invoice.number}</h1>
        <dl className="grid gap-2 sm:grid-cols-2">
          <dt className="text-muted">Data wystawienia</dt>
          <dd>{new Date(invoice.issueDate).toLocaleDateString("pl-PL")}</dd>
          <dt className="text-muted">Data sprzedaży</dt>
          <dd>{invoice.saleDate ? new Date(invoice.saleDate).toLocaleDateString("pl-PL") : "–"}</dd>
          <dt className="text-muted">Sprzedawca</dt>
          <dd>{invoice.sellerName} (NIP: {invoice.sellerNip})</dd>
          <dt className="text-muted">Nabywca</dt>
          <dd>{invoice.buyerName} (NIP: {invoice.buyerNip})</dd>
          <dt className="text-muted">Netto / VAT / Brutto</dt>
          <dd>{invoice.netAmount.toFixed(2)} / {invoice.vatAmount.toFixed(2)} / {invoice.grossAmount.toFixed(2)} {invoice.currency}</dd>
          {invoice.items && invoice.items.length > 0 && (
            <>
              <dt className="text-muted">Pozycje</dt>
              <dd className="col-span-2">
                <table className="w-full text-sm border border-border rounded overflow-hidden">
                  <thead><tr className="bg-bg/50"><th className="p-2 text-left">Nazwa</th><th className="p-2 text-right">Ilość</th><th className="p-2 text-right">Netto</th><th className="p-2 text-right">VAT</th></tr></thead>
                  <tbody>
                    {invoice.items.map((it) => (
                      <tr key={it.id} className="border-t border-border">
                        <td className="p-2">{it.name}</td>
                        <td className="p-2 text-right">{it.quantity} {it.unit}</td>
                        <td className="p-2 text-right">{it.amountNet.toFixed(2)}</td>
                        <td className="p-2 text-right">{it.amountVat.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </dd>
            </>
          )}
          <dt className="text-muted">KSEF</dt>
          <dd>{invoice.ksefSentAt ? `Wysłano ${new Date(invoice.ksefSentAt).toLocaleString("pl-PL")} ${invoice.ksefId ? `(${invoice.ksefId})` : ""}` : "Nie wysłano"}</dd>
          <dt className="text-muted">Termin płatności</dt>
          <dd>
            {invoice.paymentDueDate
              ? new Date(invoice.paymentDueDate).toLocaleDateString("pl-PL")
              : "–"}
          </dd>
          <dt className="text-muted">Źródło</dt>
          <dd>
            {invoice.source === "recurring"
              ? "Rozrachunek cykliczny"
              : invoice.source === "ksef"
                ? "Pobrano z KSEF"
                : invoice.source === "mail"
                  ? "Mail"
                  : "Wystawiona ręcznie"}
          </dd>
          <dt className="text-muted">Rozliczono</dt>
          <dd>
            {invoice.payment
              ? `Tak – ${new Date(invoice.payment.paidAt).toLocaleString("pl-PL")}`
              : "Nie"}
          </dd>
        </dl>
        {isCost && (
          <div className="mt-6 pt-6 border-t border-border space-y-4">
            <div>
              <h2 className="font-medium mb-2">Ustaw jako opłaconą</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!invoice.payment}
                  disabled={togglingPaid}
                  onChange={async () => {
                    setTogglingPaid(true);
                    try {
                      const res = await fetch("/api/payments/toggle", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ invoiceId: id }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        alert(data.error || "Błąd");
                        return;
                      }
                      loadInvoice();
                    } finally {
                      setTogglingPaid(false);
                    }
                  }}
                  className="h-4 w-4 rounded border-border bg-bg text-accent focus:ring-accent"
                />
                <span className="text-sm">
                  {invoice.payment ? "Opłacona" : "Oznacz jako opłaconą"}
                </span>
              </label>
            </div>
            <div>
              <h2 className="font-medium mb-2">Przypisz kontrahenta</h2>
              <p className="text-muted text-sm mb-2">
                Wybierz dostawcę z bazy kontrahentów, aby uzupełnić dane sprzedawcy.
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <select
                  id="contractor-select"
                  onChange={async (e) => {
                    const contractorId = e.target.value;
                    if (!contractorId) return;
                    const c = contractors.find((x) => x.id === contractorId);
                    if (!c) return;
                    setSavingContractor(true);
                    try {
                      const res = await fetch(`/api/invoices/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sellerName: c.name, sellerNip: c.nip }),
                      });
                      if (!res.ok) {
                        const d = await res.json().catch(() => ({}));
                        alert(d.error || "Błąd zapisu");
                        return;
                      }
                      const updated = await res.json();
                      setInvoice(updated);
                      e.target.value = "";
                    } finally {
                      setSavingContractor(false);
                    }
                  }}
                  disabled={savingContractor || contractors.length === 0}
                  className="rounded border border-border bg-bg px-3 py-2 min-w-[220px] disabled:opacity-50"
                >
                  <option value="">— wybierz kontrahenta —</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.nip})
                    </option>
                  ))}
                </select>
                {contractors.length === 0 && (
                  <Link href="/dashboard/contractors" className="text-sm text-accent hover:underline">
                    Dodaj kontrahentów
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
        {isCost && (
          <div className="mt-6 pt-6 border-t border-border">
            <h2 className="font-medium mb-3">Uzupełnij kwotę (rozrachunek cykliczny)</h2>
            <p className="text-muted text-sm mb-3">
              Wpisz kwoty i zapisz – np. dla ZUS, PIT-5, VAT-7 uzupełniane co miesiąc.
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs text-muted mb-1">Netto</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editNet}
                  onChange={(e) => setEditNet(e.target.value)}
                  className="rounded border border-border bg-bg px-3 py-2 w-28"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">VAT</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editVat}
                  onChange={(e) => setEditVat(e.target.value)}
                  className="rounded border border-border bg-bg px-3 py-2 w-28"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Brutto</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editGross}
                  onChange={(e) => setEditGross(e.target.value)}
                  className="rounded border border-border bg-bg px-3 py-2 w-28"
                />
              </div>
              <button
                type="button"
                disabled={savingAmount}
                onClick={async () => {
                  const net = parseFloat(editNet);
                  const vat = parseFloat(editVat);
                  const gross = parseFloat(editGross);
                  if (Number.isNaN(net) || Number.isNaN(vat) || Number.isNaN(gross) || net < 0 || vat < 0 || gross < 0) {
                    alert("Wpisz poprawne kwoty (liczby ≥ 0).");
                    return;
                  }
                  setSavingAmount(true);
                  try {
                    const res = await fetch(`/api/invoices/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ netAmount: net, vatAmount: vat, grossAmount: gross }),
                    });
                    if (!res.ok) {
                      const d = await res.json().catch(() => ({}));
                      alert(d.error || "Błąd zapisu");
                      return;
                    }
                    const updated = await res.json();
                    setInvoice(updated);
                  } finally {
                    setSavingAmount(false);
                  }
                }}
                className="rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
              >
                {savingAmount ? "Zapisywanie…" : "Zapisz kwoty"}
              </button>
            </div>
          </div>
        )}
        {invoice.source === "mail" && (invoice.emailSubject || invoice.emailBody || (invoice.emailAttachments && invoice.emailAttachments.length > 0)) && (
          <div className="mt-6 pt-6 border-t border-border">
            <h2 className="font-medium mb-3">Treść maila</h2>
            {invoice.emailFrom && (
              <p className="text-sm text-muted mb-1">
                <strong>Od:</strong> {invoice.emailFrom}
              </p>
            )}
            {invoice.emailReceivedAt && (
              <p className="text-sm text-muted mb-2">
                <strong>Data:</strong> {new Date(invoice.emailReceivedAt).toLocaleString("pl-PL")}
              </p>
            )}
            {invoice.emailSubject && (
              <p className="text-sm mb-2">
                <strong>Temat:</strong> {invoice.emailSubject}
              </p>
            )}
            {invoice.emailBody && (
              <div className="rounded border border-border bg-bg p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto mb-4">
                {invoice.emailBody}
              </div>
            )}
            {invoice.emailAttachments && invoice.emailAttachments.length > 0 && (
              <div>
                <strong className="block mb-2">Załączniki:</strong>
                <ul className="space-y-1">
                  {invoice.emailAttachments.map((att) => (
                    <li key={att.id}>
                      <a
                        href={`/api/invoices/${id}/attachments/${encodeURIComponent(att.filename)}`}
                        download
                        className="text-accent hover:underline"
                      >
                        {att.filename}
                        {att.size > 0 && (
                          <span className="text-muted text-xs ml-2">
                            ({(att.size / 1024).toFixed(1)} KB)
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <DownloadPdfButton invoiceId={id} invoiceNumber={invoice.number} ksefId={invoice.ksefId} />
          <Link href="/dashboard/rozrachunki" className="rounded border border-border px-4 py-2 hover:border-accent">
            Moduł rozrachunków
          </Link>
        </div>
      </div>
    </div>
  );
}
