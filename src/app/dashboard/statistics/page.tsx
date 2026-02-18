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

type GroupedInvoice = {
  grossAmount: number;
  netAmount: number;
  vatAmount: number;
};

type PartySummary = {
  label: string;
  count: number;
  gross: number;
  net: number;
  vat: number;
};

function formatCurrency(value: number) {
  return `${value.toFixed(2)} PLN`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return `${month}.${year}`;
}

function summarizeParties(grouped: Record<string, GroupedInvoice[]>) {
  return Object.entries(grouped)
    .map(([label, list]) => ({
      label,
      count: list.length,
      gross: list.reduce((sum, row) => sum + row.grossAmount, 0),
      net: list.reduce((sum, row) => sum + row.netAmount, 0),
      vat: list.reduce((sum, row) => sum + row.vatAmount, 0),
    }))
    .sort((a, b) => b.gross - a.gross);
}

function MetricCard({
  label,
  value,
  hint,
  valueClassName = "",
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-2xl font-semibold ${valueClassName}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-medium">{title}</h2>
      {subtitle ? <p className="text-sm text-muted mt-1">{subtitle}</p> : null}
    </div>
  );
}

export default function StatisticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [groupBy, setGroupBy] = useState<"none" | "month" | "buyer">("none");
  const [groupedSales, setGroupedSales] = useState<Record<string, GroupedInvoice[]> | null>(null);
  const [groupedCost, setGroupedCost] = useState<Record<string, GroupedInvoice[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [partyLoading, setPartyLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/invoices?groupBy=buyer&type=sales").then((r) => r.json()),
      fetch("/api/invoices?groupBy=buyer&type=cost").then((r) => r.json()),
    ])
      .then(([salesData, costData]) => {
        setGroupedSales(salesData.data || {});
        setGroupedCost(costData.data || {});
      })
      .catch(() => {
        setGroupedSales({});
        setGroupedCost({});
      })
      .finally(() => setPartyLoading(false));
  }, []);

  useEffect(() => {
    if (groupBy === "none") {
      return;
    }
    if (groupBy === "buyer" && groupedSales && groupedCost) return;

    if (groupBy === "buyer") {
      Promise.all([
        fetch("/api/invoices?groupBy=buyer&type=sales").then((r) => r.json()),
        fetch("/api/invoices?groupBy=buyer&type=cost").then((r) => r.json()),
      ])
        .then(([salesData, costData]) => {
          setGroupedSales(salesData.data || {});
          setGroupedCost(costData.data || {});
        })
        .catch(() => {
          setGroupedSales({});
          setGroupedCost({});
        });
    }
  }, [groupBy]);

  if (loading || !stats) return <p className="text-muted">Ładowanie…</p>;

  const totalGross = stats.sales.totalGross + stats.cost.totalGross;
  const totalPaidGross = stats.sales.paidGross + stats.cost.paidGross;
  const totalUnpaidGross = stats.sales.unpaidGross + stats.cost.unpaidGross;
  const totalInvoices = stats.sales.totalInvoices + stats.cost.totalInvoices;
  const grossBalance = stats.sales.totalGross - stats.cost.totalGross;
  const paymentCoverage = totalGross > 0 ? (totalPaidGross / totalGross) * 100 : 0;
  const unpaidShare = totalGross > 0 ? (totalUnpaidGross / totalGross) * 100 : 0;
  const marginPercent = stats.sales.totalGross > 0 ? (grossBalance / stats.sales.totalGross) * 100 : 0;

  const monthMap = new Map<string, { salesGross: number; costGross: number; salesCount: number; costCount: number }>();
  for (const [monthKey, value] of stats.sales.byMonth) {
    monthMap.set(monthKey, {
      salesGross: value.gross,
      costGross: monthMap.get(monthKey)?.costGross ?? 0,
      salesCount: value.count,
      costCount: monthMap.get(monthKey)?.costCount ?? 0,
    });
  }
  for (const [monthKey, value] of stats.cost.byMonth) {
    monthMap.set(monthKey, {
      salesGross: monthMap.get(monthKey)?.salesGross ?? 0,
      costGross: value.gross,
      salesCount: monthMap.get(monthKey)?.salesCount ?? 0,
      costCount: value.count,
    });
  }

  const monthSeries = Array.from(monthMap.entries())
    .map(([monthKey, values]) => ({
      monthKey,
      ...values,
      diffGross: values.salesGross - values.costGross,
    }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const maxMonthGross = Math.max(
    1,
    ...monthSeries.map((m) => Math.max(m.salesGross, m.costGross)),
  );

  const topSalesParties = groupedSales ? summarizeParties(groupedSales).slice(0, 5) : [];
  const topCostParties = groupedCost ? summarizeParties(groupedCost).slice(0, 5) : [];

  function StatsCards({ title, s, type }: { title: string; s: StatsBlock; type: "sales" | "cost" }) {
    const coverage = s.totalGross > 0 ? (s.paidGross / s.totalGross) * 100 : 0;
    const unpaid = s.totalGross > 0 ? (s.unpaidGross / s.totalGross) * 100 : 0;

    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <SectionTitle
          title={title}
          subtitle={type === "sales" ? "Przychody, wpływy i skuteczność rozliczeń." : "Koszty, wydatki i obciążenie płatnościami."}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Liczba faktur" value={String(s.totalInvoices)} />
          <MetricCard label="Suma brutto" value={formatCurrency(s.totalGross)} />
          <MetricCard
            label="Rozliczone"
            value={formatCurrency(s.paidGross)}
            hint={`${s.paidCount} faktur • ${formatPercent(coverage)}`}
            valueClassName="text-success"
          />
          <MetricCard
            label="Nierozliczone"
            value={formatCurrency(s.unpaidGross)}
            hint={formatPercent(unpaid)}
            valueClassName="text-warning"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Statystyki i dashboard</h1>
        <p className="text-sm text-muted">
          Rozbudowany podgląd finansowy: KPI globalne, trendy miesięczne, bilans oraz najwięksi kontrahenci.
        </p>
      </div>

      <section>
        <SectionTitle title="KPI globalne" subtitle="Szybki obraz sytuacji finansowej dla sprzedaży i kosztów." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Wszystkie faktury" value={String(totalInvoices)} />
          <MetricCard label="Łączny obrót brutto" value={formatCurrency(totalGross)} />
          <MetricCard
            label="Bilans brutto (sprzedaż - koszty)"
            value={formatCurrency(grossBalance)}
            valueClassName={grossBalance >= 0 ? "text-success" : "text-warning"}
          />
          <MetricCard label="Pokrycie rozliczeń" value={formatPercent(paymentCoverage)} hint={`Nierozliczone: ${formatPercent(unpaidShare)}`} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <SectionTitle title="Kondycja finansowa" subtitle="Zestawienie relacji między przychodami, kosztami i płatnościami." />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted mb-1">Przychody brutto</p>
            <p className="text-xl font-semibold text-success">{formatCurrency(stats.sales.totalGross)}</p>
            <p className="text-xs text-muted mt-1">Faktur sprzedaży: {stats.sales.totalInvoices}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted mb-1">Koszty brutto</p>
            <p className="text-xl font-semibold text-warning">{formatCurrency(stats.cost.totalGross)}</p>
            <p className="text-xs text-muted mt-1">Faktur kosztowych: {stats.cost.totalInvoices}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted mb-1">Marża brutto</p>
            <p className={`text-xl font-semibold ${grossBalance >= 0 ? "text-success" : "text-warning"}`}>
              {formatCurrency(grossBalance)}
            </p>
            <p className="text-xs text-muted mt-1">Marża względna: {formatPercent(marginPercent)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <SectionTitle title="Trend miesięczny (ostatnie miesiące)" subtitle="Porównanie sprzedaży i kosztów w czasie." />
        {monthSeries.length === 0 ? (
          <p className="text-sm text-muted">Brak danych miesięcznych do wyświetlenia trendu.</p>
        ) : (
          <div className="space-y-3">
            {monthSeries.map((month) => {
              const salesWidth = (month.salesGross / maxMonthGross) * 100;
              const costWidth = (month.costGross / maxMonthGross) * 100;

              return (
                <div key={month.monthKey} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{formatMonthLabel(month.monthKey)}</p>
                    <p className={`text-sm ${month.diffGross >= 0 ? "text-success" : "text-warning"}`}>
                      Bilans: {formatCurrency(month.diffGross)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted">
                        <span>Sprzedaż</span>
                        <span>{formatCurrency(month.salesGross)} • {month.salesCount} faktur</span>
                      </div>
                      <div className="h-2 rounded bg-bg">
                        <div className="h-2 rounded bg-success" style={{ width: `${salesWidth}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted">
                        <span>Koszty</span>
                        <span>{formatCurrency(month.costGross)} • {month.costCount} faktur</span>
                      </div>
                      <div className="h-2 rounded bg-bg">
                        <div className="h-2 rounded bg-warning" style={{ width: `${costWidth}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionTitle title="Top nabywcy (sprzedaż)" subtitle="Najwięksi odbiorcy wg wartości brutto." />
          {partyLoading ? (
            <p className="text-sm text-muted">Ładowanie kontrahentów…</p>
          ) : topSalesParties.length === 0 ? (
            <p className="text-sm text-muted">Brak danych o nabywcach.</p>
          ) : (
            <div className="space-y-3">
              {topSalesParties.map((party) => (
                <div key={party.label} className="rounded-lg border border-border p-3">
                  <p className="font-medium text-accent mb-1">{party.label}</p>
                  <p className="text-sm text-muted">Faktur: {party.count}</p>
                  <p className="text-sm">Brutto: {formatCurrency(party.gross)}</p>
                  <p className="text-xs text-muted">Netto: {formatCurrency(party.net)} • VAT: {formatCurrency(party.vat)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <SectionTitle title="Top dostawcy (koszty)" subtitle="Najwięksi dostawcy wg wartości brutto." />
          {partyLoading ? (
            <p className="text-sm text-muted">Ładowanie kontrahentów…</p>
          ) : topCostParties.length === 0 ? (
            <p className="text-sm text-muted">Brak danych o dostawcach.</p>
          ) : (
            <div className="space-y-3">
              {topCostParties.map((party) => (
                <div key={party.label} className="rounded-lg border border-border p-3">
                  <p className="font-medium text-accent mb-1">{party.label}</p>
                  <p className="text-sm text-muted">Faktur: {party.count}</p>
                  <p className="text-sm">Brutto: {formatCurrency(party.gross)}</p>
                  <p className="text-xs text-muted">Netto: {formatCurrency(party.net)} • VAT: {formatCurrency(party.vat)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <StatsCards title="Faktury sprzedaży" s={stats.sales} type="sales" />
      <StatsCards title="Faktury zakupu (kosztowe)" s={stats.cost} type="cost" />

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
                      <th className="p-3 text-right">Udział</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sales.byMonth.map(([key, v]) => (
                    <tr key={`s-${key}`} className="border-b border-border">
                      <td className="p-3">{formatMonthLabel(key)}</td>
                      <td className="p-3 text-right">{v.count}</td>
                      <td className="p-3 text-right">{formatCurrency(v.gross)}</td>
                      <td className="p-3 text-right">
                        {formatPercent(stats.sales.totalGross > 0 ? (v.gross / stats.sales.totalGross) * 100 : 0)}
                      </td>
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
                    <th className="p-3 text-right">Udział</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.cost.byMonth.map(([key, v]) => (
                    <tr key={`c-${key}`} className="border-b border-border">
                      <td className="p-3">{formatMonthLabel(key)}</td>
                      <td className="p-3 text-right">{v.count}</td>
                      <td className="p-3 text-right">{formatCurrency(v.gross)}</td>
                      <td className="p-3 text-right">
                        {formatPercent(stats.cost.totalGross > 0 ? (v.gross / stats.cost.totalGross) * 100 : 0)}
                      </td>
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
                {summarizeParties(groupedSales).map((party) => (
                  <div key={party.label} className="rounded-xl border border-border bg-card p-4">
                    <p className="font-medium text-accent mb-2">{party.label}</p>
                    <p className="text-sm text-muted">Faktur: {party.count}</p>
                    <p className="text-sm">Suma brutto: {formatCurrency(party.gross)}</p>
                    <p className="text-xs text-muted">Netto: {formatCurrency(party.net)} • VAT: {formatCurrency(party.vat)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {groupedCost && Object.keys(groupedCost).length > 0 && (
            <div>
              <h2 className="font-medium mb-4">Faktury zakupu – według dostawców</h2>
              <div className="space-y-4">
                {summarizeParties(groupedCost).map((party) => (
                  <div key={party.label} className="rounded-xl border border-border bg-card p-4">
                    <p className="font-medium text-accent mb-2">{party.label}</p>
                    <p className="text-sm text-muted">Faktur: {party.count}</p>
                    <p className="text-sm">Suma brutto: {formatCurrency(party.gross)}</p>
                    <p className="text-xs text-muted">Netto: {formatCurrency(party.net)} • VAT: {formatCurrency(party.vat)}</p>
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
