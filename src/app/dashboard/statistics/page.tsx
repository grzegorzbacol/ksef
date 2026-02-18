"use client";

import { useEffect, useState } from "react";

type StatsBlock = {
  totalInvoices: number;
  totalGross: number;
  totalNet: number;
  totalVat: number;
  paidCount: number;
  paidGross: number;
  unpaidGross: number;
  byMonth: [string, { count: number; gross: number }][];
};

type Stats = {
  sales: StatsBlock;
  cost: StatsBlock;
};

export default function StatisticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [groupBy, setGroupBy] = useState<"none" | "month" | "buyer">("none");
  const [groupedSales, setGroupedSales] = useState<Record<string, unknown[]> | null>(null);
  const [groupedCost, setGroupedCost] = useState<Record<string, unknown[]> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (groupBy === "none") {
      setGroupedSales(null);
      setGroupedCost(null);
      return;
    }
    const q = groupBy === "month" ? "groupBy=month" : "groupBy=buyer";
    Promise.all([
      fetch(`/api/invoices?${q}&type=sales`).then((r) => r.json()),
      fetch(`/api/invoices?${q}&type=cost`).then((r) => r.json()),
    ])
      .then(([salesData, costData]) => {
        setGroupedSales(salesData.data || {});
        setGroupedCost(costData.data || {});
      })
      .catch(() => {
        setGroupedSales(null);
        setGroupedCost(null);
      });
  }, [groupBy]);

  if (loading || !stats) return <p className="text-muted">Ładowanie…</p>;

  function StatsCards({ title, s }: { title: string; s: StatsBlock }) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-medium mb-4">{title}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted">Liczba faktur</p>
            <p className="text-2xl font-semibold">{s.totalInvoices}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted">Suma brutto (PLN)</p>
            <p className="text-2xl font-semibold">{s.totalGross.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted">Opłacone (brutto)</p>
            <p className="text-2xl font-semibold text-success">{s.paidGross.toFixed(2)}</p>
            <p className="text-xs text-muted">{s.paidCount} faktur</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted">Nieopłacone (brutto)</p>
            <p className="text-2xl font-semibold text-warning">{s.unpaidGross.toFixed(2)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Statystyki</h1>

      <StatsCards title="Faktury sprzedaży" s={stats.sales} />
      <StatsCards title="Faktury zakupu (kosztowe)" s={stats.cost} />

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
            Po nabywcach / dostawcach
          </button>
        </div>
      </div>

      {groupBy === "month" && (
        <div className="space-y-8">
          {stats.sales.byMonth && stats.sales.byMonth.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <h2 className="p-4 border-b border-border font-medium">Faktury sprzedaży – według miesięcy</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg/50">
                    <th className="p-3 text-left">Miesiąc</th>
                    <th className="p-3 text-right">Liczba</th>
                    <th className="p-3 text-right">Brutto</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sales.byMonth.map(([key, v]) => (
                    <tr key={`s-${key}`} className="border-b border-border">
                      <td className="p-3">{key}</td>
                      <td className="p-3 text-right">{v.count}</td>
                      <td className="p-3 text-right">{v.gross.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {stats.cost.byMonth && stats.cost.byMonth.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <h2 className="p-4 border-b border-border font-medium">Faktury zakupu – według miesięcy</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg/50">
                    <th className="p-3 text-left">Miesiąc</th>
                    <th className="p-3 text-right">Liczba</th>
                    <th className="p-3 text-right">Brutto</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.cost.byMonth.map(([key, v]) => (
                    <tr key={`c-${key}`} className="border-b border-border">
                      <td className="p-3">{key}</td>
                      <td className="p-3 text-right">{v.count}</td>
                      <td className="p-3 text-right">{v.gross.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(!stats.sales.byMonth || stats.sales.byMonth.length === 0) && (!stats.cost.byMonth || stats.cost.byMonth.length === 0) && (
            <p className="text-muted">Brak danych do grupowania po miesiącach.</p>
          )}
        </div>
      )}

      {groupBy === "buyer" && (groupedSales || groupedCost) && (
        <div className="space-y-8">
          {groupedSales && Object.keys(groupedSales).length > 0 && (
            <div>
              <h2 className="font-medium mb-4">Faktury sprzedaży – według nabywców</h2>
              <div className="space-y-4">
                {Object.entries(groupedSales).map(([label, list]) => (
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
            </div>
          )}
          {groupedCost && Object.keys(groupedCost).length > 0 && (
            <div>
              <h2 className="font-medium mb-4">Faktury zakupu – według dostawców</h2>
              <div className="space-y-4">
                {Object.entries(groupedCost).map(([label, list]) => (
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
            </div>
          )}
          {(!groupedSales || Object.keys(groupedSales).length === 0) && (!groupedCost || Object.keys(groupedCost).length === 0) && (
            <p className="text-muted">Brak danych do grupowania po nabywcach/dostawcach.</p>
          )}
        </div>
      )}
    </div>
  );
}
