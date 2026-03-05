"use client";

import { useEffect, useState } from "react";
import { MonthYearFilter } from "@/components/MonthYearFilter";
import { formatCurrency } from "@/lib/budget";

type CategorySummary = {
  categoryId: string;
  categoryName: string;
  sortOrder: number;
  plannedAmount: number;
  actualAmount: number;
  remaining: number;
  utilizationPercent: number;
};

type Summary = {
  month: number;
  year: number;
  totalPlanned: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  plannedExpenses: number;
  remainingBudget: number;
  categories: CategorySummary[];
  transactions: {
    id: string;
    date: string;
    amount: number;
    memo: string | null;
    category: { id: string; name: string };
  }[];
};

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

function formatMonthLabel(month: number, year: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function MetricCard({
  label,
  value,
  valueClassName = "",
  hint,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-2xl font-semibold ${valueClassName}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export default function BudgetPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newTx, setNewTx] = useState({ date: "", amount: 0, categoryId: "", memo: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/budget/summary?month=${month}&year=${year}`).then((r) => r.json()),
      fetch("/api/budget-categories").then((r) => r.json()),
    ])
      .then(([sumData, catData]) => {
        setSummary(sumData);
        setCategories(Array.isArray(catData) ? catData : []);
      })
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [month, year]);

  async function saveAllocation(categoryId: string, plannedAmount: number) {
    setSaving(true);
    try {
      const res = await fetch("/api/budget-allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, categoryId, plannedAmount }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Błąd zapisu");
        return;
      }
      const data = await fetch(`/api/budget/summary?month=${month}&year=${year}`).then((r) => r.json());
      setSummary(data);
      setEditingAllocation(null);
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/budget-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Błąd dodawania kategorii");
        return;
      }
      const list = await fetch("/api/budget-categories").then((r) => r.json());
      setCategories(list);
      setNewCategoryName("");
      setShowAddCategory(false);
      const data = await fetch(`/api/budget/summary?month=${month}&year=${year}`).then((r) => r.json());
      setSummary(data);
    } finally {
      setSaving(false);
    }
  }

  async function addTransaction() {
    if (!newTx.date || !newTx.categoryId) {
      alert("Data i kategoria są wymagane");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/budget-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newTx.date,
          amount: newTx.amount,
          categoryId: newTx.categoryId,
          memo: newTx.memo || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Błąd dodawania transakcji");
        return;
      }
      const data = await fetch(`/api/budget/summary?month=${month}&year=${year}`).then((r) => r.json());
      setSummary(data);
      setNewTx({ date: "", amount: 0, categoryId: "", memo: "" });
      setShowAddTransaction(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Usunąć transakcję?")) return;
    const res = await fetch(`/api/budget-transactions/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    const data = await fetch(`/api/budget/summary?month=${month}&year=${year}`).then((r) => r.json());
    setSummary(data);
  }

  if (loading && !summary) {
    return <p className="text-muted">Ładowanie…</p>;
  }

  const s = summary ?? {
    month,
    year,
    totalPlanned: 0,
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    plannedExpenses: 0,
    remainingBudget: 0,
    categories: [],
    transactions: [],
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Budżet</h1>
          <p className="text-sm text-muted mt-1">
            Planowanie i śledzenie wydatków w stylu YNAB. Ustaw planowane kwoty i dodawaj transakcje.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthYearFilter month={month} year={year} onChange={(m, y) => { setMonth(m ?? month); setYear(y ?? year); }} />
          <button
            type="button"
            onClick={() => setShowAddCategory(true)}
            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg"
          >
            Nowa kategoria
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date(year, month - 1, 1);
              setNewTx({ date: d.toISOString().slice(0, 10), amount: 0, categoryId: "", memo: "" });
              setShowAddTransaction(true);
            }}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Nowa transakcja
          </button>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-4">Podsumowanie {formatMonthLabel(month, year)}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Planowane wydatki" value={formatCurrency(s.totalPlanned)} />
          <MetricCard label="Przychody" value={formatCurrency(s.totalIncome)} valueClassName="text-success" />
          <MetricCard label="Wydatki rzeczywiste" value={formatCurrency(s.totalExpenses)} valueClassName="text-warning" />
          <MetricCard
            label="Pozostały budżet"
            value={formatCurrency(s.remainingBudget)}
            valueClassName={s.remainingBudget >= 0 ? "text-success" : "text-warning"}
            hint={`Bilans: ${formatCurrency(s.balance)}`}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <h2 className="p-4 border-b border-border font-medium">Kategorie budżetu</h2>
        {s.categories.length === 0 ? (
          <p className="p-4 text-muted text-sm">Brak kategorii. Dodaj kategorię i ustaw planowane kwoty.</p>
        ) : (
          <div className="divide-y divide-border">
            {s.categories.map((cat) => {
              const spent = cat.actualAmount < 0 ? Math.abs(cat.actualAmount) : 0;
              const overBudget = spent > cat.plannedAmount && cat.plannedAmount > 0;
              return (
                <div key={cat.categoryId} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{cat.categoryName}</p>
                    {editingAllocation === cat.categoryId ? (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={cat.plannedAmount}
                          id={`alloc-${cat.categoryId}`}
                          className="w-32 rounded border border-border bg-bg px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const inp = document.getElementById(`alloc-${cat.categoryId}`) as HTMLInputElement;
                            const v = parseFloat(inp?.value ?? "0") || 0;
                            saveAllocation(cat.categoryId, v);
                          }}
                          disabled={saving}
                          className="rounded bg-accent px-2 py-1 text-sm text-white hover:opacity-90 disabled:opacity-50"
                        >
                          Zapisz
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingAllocation(null)}
                          className="rounded border border-border px-2 py-1 text-sm hover:bg-bg"
                        >
                          Anuluj
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-muted">
                          {formatCurrency(cat.plannedAmount)} planowane
                          {spent > 0 && ` • ${formatCurrency(spent)} wydane`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingAllocation(cat.categoryId)}
                          className="text-xs text-accent hover:underline"
                        >
                          Edytuj
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 w-full sm:w-48">
                    <div className="h-2 rounded-full bg-bg overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${overBudget ? "bg-warning" : "bg-accent"}`}
                        style={{ width: `${Math.min(100, cat.utilizationPercent)}%` }}
                      />
                    </div>
                    <p className={`text-xs mt-1 ${overBudget ? "text-warning" : "text-muted"}`}>
                      {cat.utilizationPercent.toFixed(0)}% wykorzystane
                      {cat.remaining !== cat.plannedAmount && (
                        <> • Pozostało: {formatCurrency(Math.max(0, cat.remaining))}</>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <h2 className="p-4 border-b border-border font-medium">Transakcje {formatMonthLabel(month, year)}</h2>
        {s.transactions.length === 0 ? (
          <p className="p-4 text-muted text-sm">Brak transakcji w tym miesiącu. Kliknij „Nowa transakcja” aby dodać.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg/50">
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 text-left">Kategoria</th>
                  <th className="p-3 text-left">Opis</th>
                  <th className="p-3 text-right">Kwota</th>
                  <th className="p-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {s.transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border">
                    <td className="p-3">{new Date(tx.date).toLocaleDateString("pl-PL")}</td>
                    <td className="p-3">{tx.category.name}</td>
                    <td className="p-3 text-muted">{tx.memo ?? "—"}</td>
                    <td className={`p-3 text-right ${tx.amount >= 0 ? "text-success" : "text-warning"}`}>
                      {tx.amount >= 0 ? "+" : ""}{formatCurrency(tx.amount)}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => deleteTransaction(tx.id)}
                        className="text-warning hover:underline text-xs"
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
      </section>

      {showAddCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-xl border border-border bg-card p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Nowa kategoria</h3>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nazwa kategorii"
              className="w-full rounded border border-border bg-bg px-3 py-2 mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAddCategory(false)} className="rounded border border-border px-4 py-2 hover:bg-bg">
                Anuluj
              </button>
              <button type="button" onClick={addCategory} disabled={saving || !newCategoryName.trim()} className="rounded bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50">
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-xl border border-border bg-card p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Nowa transakcja</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Data</label>
                <input
                  type="date"
                  value={newTx.date}
                  onChange={(e) => setNewTx((p) => ({ ...p, date: e.target.value }))}
                  className="w-full rounded border border-border bg-bg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Kategoria</label>
                <select
                  value={newTx.categoryId}
                  onChange={(e) => setNewTx((p) => ({ ...p, categoryId: e.target.value }))}
                  className="w-full rounded border border-border bg-bg px-3 py-2"
                >
                  <option value="">— wybierz —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Kwota (ujemna = wydatek)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newTx.amount || ""}
                  onChange={(e) => setNewTx((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                  placeholder="-100.00"
                  className="w-full rounded border border-border bg-bg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Opis (opcjonalnie)</label>
                <input
                  type="text"
                  value={newTx.memo}
                  onChange={(e) => setNewTx((p) => ({ ...p, memo: e.target.value }))}
                  placeholder="Memo"
                  className="w-full rounded border border-border bg-bg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowAddTransaction(false)} className="rounded border border-border px-4 py-2 hover:bg-bg">
                Anuluj
              </button>
              <button type="button" onClick={addTransaction} disabled={saving || !newTx.date || !newTx.categoryId} className="rounded bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50">
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
