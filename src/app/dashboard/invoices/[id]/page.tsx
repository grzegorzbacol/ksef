"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

function DownloadPdfButton({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string }) {
  const [loading, setLoading] = useState(false);
  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Błąd pobierania");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Faktura_${invoiceNumber.replace(/\//g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Nie udało się pobrać PDF.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="rounded bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
    >
      {loading ? "Pobieranie…" : "Pobierz PDF"}
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
  items?: InvoiceItem[];
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setInvoice)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-muted">Ładowanie…</p>;
  if (!invoice) return <p className="text-muted">Nie znaleziono faktury.</p>;

  return (
    <div>
      <div className="mb-4">
        <Link href="/dashboard/invoices" className="text-accent hover:underline">← Lista faktur</Link>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h1 className="text-xl font-semibold">Faktura {invoice.number}</h1>
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
          <dt className="text-muted">Źródło</dt>
          <dd>{invoice.source === "ksef" ? "Pobrano z KSEF" : "Wystawiona ręcznie"}</dd>
          <dt className="text-muted">Opłacono</dt>
          <dd>
            {invoice.payment
              ? `Tak – ${new Date(invoice.payment.paidAt).toLocaleString("pl-PL")}`
              : "Nie"}
          </dd>
        </dl>
        <div className="flex gap-3 pt-2">
          <DownloadPdfButton invoiceId={id} invoiceNumber={invoice.number} />
          <Link href="/dashboard/payments" className="rounded border border-border px-4 py-2 hover:border-accent">
            Moduł płatności
          </Link>
        </div>
      </div>
    </div>
  );
}
