"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/budget";

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

type CategoryWithActivity = {
  id: string;
  name: string;
  groupName: string;
  isPrivateExpenses?: boolean;
  allocated: number;
  activity: number;
  available: number;
  overspent: boolean;
};

type Summary = {
  month: number;
  year: number;
  toBeBudgeted: number;
  totalAllocated: number;
  totalActivity: number;
  overspentCategories: string[];
  categories: CategoryWithActivity[];
};

type Transaction = {
  id: string;
  date: string;
  amount: number;
  memo: string | null;
  isPrivate: boolean;
  account: { name: string };
  category: { name: string; group: { name: string } } | null;
  payee: { name: string } | null;
};

type Account = { id: string; name: string; balance: number; type: string };
type Payee = { id: string; name: string };
type Category = { id: string; name: string; group: { name: string }; groupId: string };

function MetricCard({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-2xl font-semibold ${valueClassName}`}>{value}</p>
    </div>
  );
}

export default function PersonalBudgetDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTx, setShowAddTx] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTx, setNewTx] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    accountId: "",
    categoryId: "",
    payeeId: "",
    memo: "",
    isPrivate: false,
  });

  function load() {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/personal-budget/${id}/summary?month=${month}&year=${year}`).then((r) => r.json()),
      fetch(`/api/personal-budget/${id}/transactions?month=${month}&year=${year}`).then((r) => r.json()),
      fetch(`/api/personal-budget/${id}/accounts`).then((r) => r.json()),
      fetch(`/api/personal-budget/${id}`).then((r) => r.json()),
    ])
      .then(([sum, txs, accs, budget]) => {
        setSummary(sum);
        setTransactions(Array.isArray(txs) ? txs : []);
        setAccounts(Array.isArray(accs) ? accs : []);
        const cats: Category[] = [];
        for (const g of budget.categoryGroups ?? []) {
          for (const c of g.categories ?? []) {
            cats.push({ ...c, group: g });
          }
        }
        setCategories(cats);
        setPayees(budget.payees ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [id, month, year]);

  async function addTransaction() {
    if (!id || !newTx.accountId || !newTx.amount) {
      alert("Konto i kwota są wymagane");
      return;
    }
    const amount = parseFloat(newTx.amount.replace(",", "."));
    if (isNaN(amount) || amount === 0) {
      alert("Podaj poprawną kwotę");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/personal-budget/${id}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: newTx.accountId,
          date: newTx.date,
          amount,
          categoryId: newTx.categoryId || null,
          payeeId: newTx.payeeId || null,
          memo: newTx.memo || null,
          isPrivate: newTx.isPrivate,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Błąd dodawania transakcji");
        return;
      }
      setNewTx({
        date: new Date().toISOString().slice(0, 10),
        amount: "",
        accountId: newTx.accountId,
        categoryId: "",
        payeeId: "",
        memo: "",
        isPrivate: false,
      });
      setShowAddTx(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteTransaction(txId: string) {
    if (!confirm("Usunąć transakcję?")) return;
    const res = await fetch(`/api/personal-budget/${id}/transactions/${txId}`, { method: "DELETE" });
    if (res.ok) load();
  }

  if (!id || (loading && !summary)) {
    return <p className="text-muted">Ładowanie…</p>;
  }

  const s = summary ?? {
    month,
    year,
    toBeBudgeted: 0,
    totalAllocated: 0,
    totalActivity: 0,
    overspentCategories: [],
    categories: [],
  };

  const formatMonthLabel = () => `${MONTH_NAMES[month - 1]} ${year}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/personal-budget" className="text-muted hover:text-text">
            ← Budżet osobisty
          </Link>
          <h1 className="text-2xl font-semibold">Budżet osobisty</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          >
            {MONTH_NAMES.map((n, i) => (
              <option key={i} value={i + 1}>{n}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm"
          >
            {[year - 2, year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setNewTx((p) => ({
                ...p,
                date: new Date().toISOString().slice(0, 10),
                accountId: accounts[0]?.id ?? "",
              }));
              setShowAddTx(true);
            }}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Nowa transakcja
          </button>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-4">Podsumowanie {formatMonthLabel()}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Do przydzielenia (To Be Budgeted)"
            value={formatCurrency(s.toBeBudgeted)}
            valueClassName={s.toBeBudgeted >= 0 ? "text-success" : "text-warning"}
          />
          <MetricCard label="Przydzielone" value={formatCurrency(s.totalAllocated)} />
          <MetricCard label="Activity" value={formatCurrency(s.totalActivity)} />
          <MetricCard
            label="Przekroczone kategorie"
            value={s.overspentCategories.length > 0 ? s.overspentCategories.join(", ") : "Brak"}
            valueClassName={s.overspentCategories.length > 0 ? "text-warning text-base" : ""}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <h2 className="p-4 border-b border-border font-medium">Kategorie</h2>
        {s.categories.length === 0 ? (
          <p className="p-4 text-muted text-sm">Brak kategorii.</p>
        ) : (
          <div className="divide-y divide-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg/50">
                  <th className="p-3 text-left">Grupa / Kategoria</th>
                  <th className="p-3 text-right">Przydzielone</th>
                  <th className="p-3 text-right">Activity</th>
                  <th className="p-3 text-right">Dostępne</th>
                </tr>
              </thead>
              <tbody>
                {s.categories.map((c) => (
                  <tr key={c.id} className={c.overspent ? "bg-warning-muted/30" : ""}>
                    <td className="p-3">
                      <span className="text-muted">{c.groupName} / </span>
                      {c.name}
                      {c.groupName === "Wydatki prywatne" && (
                        <span className="ml-2 text-xs rounded bg-accent-muted text-accent px-1.5 py-0.5">
                          wydatki prywatne
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">{formatCurrency(c.allocated)}</td>
                    <td className={`p-3 text-right ${c.activity < 0 ? "text-warning" : "text-success"}`}>
                      {formatCurrency(c.activity)}
                    </td>
                    <td className={`p-3 text-right font-medium ${c.overspent ? "text-warning" : ""}`}>
                      {formatCurrency(c.available)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <h2 className="p-4 border-b border-border font-medium">
          Transakcje {formatMonthLabel()} – w tym wydatki prywatne
        </h2>
        {transactions.length === 0 ? (
          <p className="p-4 text-muted text-sm">
            Brak transakcji. Kliknij „Nowa transakcja” i dodaj przychód lub wydatek (w tym wydatki prywatne).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg/50">
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 text-left">Konto</th>
                  <th className="p-3 text-left">Odbiorca / Kategoria</th>
                  <th className="p-3 text-right">Kwota</th>
                  <th className="p-3 w-20">Prywatne</th>
                  <th className="p-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-border">
                    <td className="p-3">{new Date(tx.date).toLocaleDateString("pl-PL")}</td>
                    <td className="p-3">{tx.account.name}</td>
                    <td className="p-3">
                      {tx.payee?.name ?? "—"} / {tx.category?.name ?? "—"}
                    </td>
                    <td className={`p-3 text-right ${tx.amount >= 0 ? "text-success" : "text-warning"}`}>
                      {tx.amount >= 0 ? "+" : ""}{formatCurrency(tx.amount)}
                    </td>
                    <td className="p-3">
                      {tx.isPrivate ? (
                        <span className="text-xs rounded bg-accent-muted text-accent px-1.5 py-0.5">
                          Tak
                        </span>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
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

      {showAddTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-xl border border-border bg-card p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Nowa transakcja</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Konto</label>
                <select
                  value={newTx.accountId}
                  onChange={(e) => setNewTx((p) => ({ ...p, accountId: e.target.value }))}
                  className="w-full rounded border border-border bg-bg px-3 py-2"
                >
                  <option value="">— wybierz —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>
                  ))}
                </select>
              </div>
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
                <label className="block text-sm text-muted mb-1">Kwota (+ przychód, − wydatek)</label>
                <input
                  type="text"
                  value={newTx.amount}
                  onChange={(e) => setNewTx((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="-50.00"
                  className="w-full rounded border border-border bg-bg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Odbiorca</label>
                <select
                  value={newTx.payeeId}
                  onChange={(e) => setNewTx((p) => ({ ...p, payeeId: e.target.value }))}
                  className="w-full rounded border border-border bg-bg px-3 py-2"
                >
                  <option value="">— opcjonalnie —</option>
                  {payees.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Kategoria</label>
                <select
                  value={newTx.categoryId}
                  onChange={(e) => setNewTx((p) => ({ ...p, categoryId: e.target.value }))}
                  className="w-full rounded border border-border bg-bg px-3 py-2"
                >
                  <option value="">— opcjonalnie —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.group.name} / {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Memo</label>
                <input
                  type="text"
                  value={newTx.memo}
                  onChange={(e) => setNewTx((p) => ({ ...p, memo: e.target.value }))}
                  placeholder="Opcjonalnie"
                  className="w-full rounded border border-border bg-bg px-3 py-2"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTx.isPrivate}
                  onChange={(e) => setNewTx((p) => ({ ...p, isPrivate: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-sm">Wydatek prywatny</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => setShowAddTx(false)}
                className="rounded border border-border px-4 py-2 hover:bg-bg"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={addTransaction}
                disabled={saving || !newTx.accountId || !newTx.amount}
                className="rounded bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Zapisywanie…" : "Dodaj transakcję"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
