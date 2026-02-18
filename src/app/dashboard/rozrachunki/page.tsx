"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Invoice = {
  id: string;
  number: string;
  issueDate: string;
  sellerName: string;
  grossAmount: number;
  currency: string;
  paymentDueDate: string | null;
  payment?: { paidAt: string } | null;
  source: string;
  handedOverToAccountant?: boolean;
};

type RecurringSettlement = {
  code: string;
  name: string;
  formName: string;
  sellerName: string;
};

export default function RozrachunkiPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recurring, setRecurring] = useState<RecurringSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingDueId, setUpdatingDueId] = useState<string | null>(null);
  const [updatingAccountantId, setUpdatingAccountantId] = useState<string | null>(null);
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState("");
  const [savingAmountId, setSavingAmountId] = useState<string | null>(null);

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

  useEffect(() => {
    fetch("/api/recurring-settlements")
      .then((r) => r.json())
      .then((data) => setRecurring(Array.isArray(data) ? data : []))
      .catch(() => setRecurring([]));
  }, []);

  // Automatyczne generowanie rozrachunków cyklicznych (ZUS, PIT-5, VAT-7) na bieżący miesiąc przy wejściu na stronę
  useEffect(() => {
    fetch("/api/recurring-settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (data.created > 0) load();
      })
      .catch(() => {});
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

  async function handleDelete(invoiceId: string, number: string) {
    if (!confirm(`Usunąć fakturę ${number} z rozrachunków?`)) return;
    setDeletingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      if (!res.ok) alert("Błąd usuwania");
      else load();
    } finally {
      setDeletingId(null);
    }
  }

  async function updatePaymentDueDate(invoiceId: string, value: string | null) {
    setUpdatingDueId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentDueDate: value === "" ? null : value,
        }),
      });
      if (!res.ok) alert("Błąd zapisu terminu");
      else load();
    } finally {
      setUpdatingDueId(null);
    }
  }

  async function toggleHandedOverToAccountant(invoiceId: string, current: boolean) {
    setUpdatingAccountantId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handedOverToAccountant: !current }),
      });
      if (!res.ok) alert("Błąd zapisu");
      else load();
    } finally {
      setUpdatingAccountantId(null);
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
      else load();
    } finally {
      setSavingAmountId(null);
      setEditingAmountId(null);
    }
  }

  if (loading) return <p className="text-muted">Ładowanie…</p>;

  const paidCount = invoices.filter((i) => i.payment).length;
  const unpaidCount = invoices.length - paidCount;

  async function generateRecurring() {
    try {
      const res = await fetch("/api/recurring-settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Błąd generowania");
        return;
      }
      if (data.created > 0) {
        load();
      }
    } catch {
      alert("Błąd połączenia");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Rozrachunki</h1>
      <p className="text-muted text-sm mb-6">
        Zaznacz checkbox, aby zarejestrować rozliczenie faktury (zapisujemy datę).
      </p>

      <div className="mb-6 rounded-xl border border-border bg-card p-4 max-w-2xl">
        <h2 className="font-medium mb-2">Rozrachunki cykliczne (ZUS, PIT-5, VAT-7)</h2>
        {recurring.length > 0 && (
          <p className="text-muted text-sm mb-2">
            Nazewnictwo z formularzem:{" "}
            {recurring
              .map((r) => {
                const inst = r.code === "zus" ? "ZUS" : "US";
                return r.formName ? `${inst} – ${r.formName}` : r.name;
              })
              .join(", ")}
          </p>
        )}
        <p className="text-muted text-sm mb-3">
          Pozycje na bieżący miesiąc są generowane automatycznie przy wejściu na tę stronę (kwota 0 – uzupełnisz ręcznie w tabeli poniżej).
        </p>
        <button
          type="button"
          onClick={generateRecurring}
          className="rounded-lg border border-border px-4 py-2 hover:bg-bg/80"
        >
          Wygeneruj ponownie na ten miesiąc
        </button>
      </div>

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
              <th className="p-3 text-left">Termin płatności</th>
              <th className="p-3 text-left">Data rozliczenia</th>
              <th className="p-3 text-left w-40">Przekazane księgowej</th>
              <th className="p-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted">
                  Brak faktur. Dodaj faktury w module Faktury zakupu lub pobierz z KSEF.
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
                  <td className="p-3 font-medium">
                    <Link href={`/dashboard/invoices-sales/${inv.id}`} className="text-accent hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="p-3">{new Date(inv.issueDate).toLocaleDateString("pl-PL")}</td>
                  <td className="p-3">{inv.sellerName}</td>
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
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
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
                  <td className="p-3">
                    {inv.payment ? (
                      inv.paymentDueDate
                        ? new Date(inv.paymentDueDate).toLocaleDateString("pl-PL")
                        : "–"
                    ) : (
                      <input
                        type="date"
                        value={
                          inv.paymentDueDate
                            ? new Date(inv.paymentDueDate).toISOString().slice(0, 10)
                            : ""
                        }
                        disabled={updatingDueId === inv.id}
                        onChange={(e) =>
                          updatePaymentDueDate(inv.id, e.target.value || null)
                        }
                        className="rounded border border-border bg-bg px-2 py-1 text-sm w-36"
                      />
                    )}
                  </td>
                  <td className="p-3 text-muted">
                    {inv.payment
                      ? new Date(inv.payment.paidAt).toLocaleString("pl-PL")
                      : "–"}
                  </td>
                  <td className="p-3">
                    {inv.source === "ksef" ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={!!inv.handedOverToAccountant}
                        disabled={updatingAccountantId === inv.id}
                        onChange={() =>
                          toggleHandedOverToAccountant(inv.id, !!inv.handedOverToAccountant)
                        }
                        className="h-4 w-4 rounded border-border bg-bg text-accent focus:ring-accent"
                        title="Przekazane księgowej"
                      />
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => handleDelete(inv.id, inv.number)}
                      disabled={deletingId === inv.id}
                      className="text-red-400 hover:underline disabled:opacity-50"
                    >
                      Usuń
                    </button>
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
