"use client";

import { useEffect, useState } from "react";

type Stats = {
  totalInvoices: number;
  totalGross: number;
  totalNet: number;
  totalVat: number;
  paidCount: number;
  paidGross: number;
  unpaidGross: number;
  byMonth: [string, { count: number; gross: number }][];
};

export default function StatisticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [groupBy, setGroupBy] = useState<"none" | "month" | "buyer">("none");
  const [grouped, setGrouped] = useState<Record<string, unknown[]> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (groupBy === "none") {
      setGrouped(null);
      return;
    }
    const q = groupBy === "month" ? "groupBy=month" : "groupBy=buyer";
    fetch(`/api/invoices?${q}`)
      .then((r) => r.json())
      .then((data) => setGrouped(data.data || {}))
      .catch(() => setGrouped(null));
  }, [groupBy]);

  if (loading || !stats) return <p className="text-muted">Ładowanie…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Statystyki</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted">Liczba faktur</p>
          <p className="text-2xl font-semibold">{stats.totalInvoices}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted">Suma brutto (PLN)</p>
          <p className="text-2xl font-semibold">{stats.totalGross.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted">Opłacone (brutto)</p>
          <p className="text-2xl font-semibold text-success">{stats.paidGross.toFixed(2)}</p>
          <p className="text-xs text-muted">{stats.paidCount} faktur</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted">Nieopłacone (brutto)</p>
          <p className="text-2xl font-semibold text-warning">{stats.unpaidGross.toFixed(2)}</p>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-sm text-muted mb-2">Grupowanie</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setGroupBy("none")}
            className={`rounded-lg px-4 py-2 ${groupBy === "none" ? "bg-accent text-white" : "bg-card border border-border"}`}
          >
            Brak
          </button>
          <button
            type="button"
            onClick={() => setGroupBy("month")}
            className={`rounded-lg px-4 py-2 ${groupBy === "month" ? "bg-accent text-white" : "bg-card border border-border"}`}
          >
            Po miesiącach
          </button>
          <button
            type="button"
            onClick={() => setGroupBy("buyer")}
            className={`rounded-lg px-4 py-2 ${groupBy === "buyer" ? "bg-accent text-white" : "bg-card border border-border"}`}
          >
            Po nabywcach
          </button>
        </div>
      </div>

      {groupBy === "month" && stats.byMonth && stats.byMonth.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden mb-8">
          <h2 className="p-4 border-b border-border font-medium">Według miesięcy</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg/50">
                <th className="p-3 text-left">Miesiąc</th>
                <th className="p-3 text-right">Liczba</th>
                <th className="p-3 text-right">Brutto</th>
              </tr>
            </thead>
            <tbody>
              {stats.byMonth.map(([key, v]) => (
                <tr key={key} className="border-b border-border">
                  <td className="p-3">{key}</td>
                  <td className="p-3 text-right">{v.count}</td>
                  <td className="p-3 text-right">{v.gross.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {groupBy === "buyer" && grouped && (
        <div className="space-y-4">
          <h2 className="font-medium">Według nabywców</h2>
          {Object.entries(grouped).map(([label, list]) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <p className="font-medium text-accent mb-2">{label}</p>
              <p className="text-sm text-muted">Faktur: {(list as unknown[]).length}</p>
              <p className="text-sm">
                Suma brutto:{" "}
                {(list as { grossAmount: number }[]).reduce((s, i) => s + i.grossAmount, 0).toFixed(2)} PLN
              </p>
            </div>
          ))}
        </div>
      )}

      {groupBy === "month" && (!stats.byMonth || stats.byMonth.length === 0) && (
        <p className="text-muted">Brak danych do grupowania po miesiącach.</p>
      )}
      {groupBy === "buyer" && grouped && Object.keys(grouped).length === 0 && (
        <p className="text-muted">Brak danych do grupowania po nabywcach.</p>
      )}
    </div>
  );
}
