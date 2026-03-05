"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PersonalBudget = {
  id: string;
  name: string;
  currency: string;
  accounts: { id: string; name: string; balance: number; isOnBudget: boolean }[];
  categoryGroups: { id: string; name: string; isPrivateExpenses: boolean }[];
};

export default function PersonalBudgetListPage() {
  const [budgets, setBudgets] = useState<PersonalBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("Budżet osobisty");

  useEffect(() => {
    fetch("/api/personal-budget")
      .then((r) => r.json())
      .then((data) => setBudgets(Array.isArray(data) ? data : []))
      .catch(() => setBudgets([]))
      .finally(() => setLoading(false));
  }, []);

  async function createBudget() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/personal-budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const b = await res.json();
      if (res.ok) {
        setBudgets((prev) => [...prev, b]);
        setNewName("Budżet osobisty");
      } else {
        alert(b.error || "Błąd tworzenia budżetu");
      }
    } finally {
      setCreating(false);
    }
  }

  function formatCurrency(v: number) {
    return `${v.toFixed(2)} PLN`;
  }

  if (loading) {
    return <p className="text-muted">Ładowanie…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Budżet osobisty</h1>
          <p className="text-sm text-muted mt-1">
            Zero-based budgeting (YNAB-style). Osobny moduł do budżetowania osobistego i{" "}
            <strong>wydatków prywatnych</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nazwa budżetu"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm w-48"
          />
          <button
            type="button"
            onClick={createBudget}
            disabled={creating || !newName.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Tworzenie…" : "Nowy budżet"}
          </button>
        </div>
      </div>

      {budgets.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted mb-4">Nie masz jeszcze żadnego budżetu osobistego.</p>
          <p className="text-sm text-muted mb-6">
            Utwórz budżet (np. „Osobisty”, „Rodzinny”) – otrzymasz domyślne grupy kategorii,
            w tym <strong>„Wydatki prywatne”</strong>.
          </p>
          <div className="flex justify-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nazwa budżetu"
              className="rounded-lg border border-border bg-bg px-3 py-2 text-sm w-56"
            />
            <button
              type="button"
              onClick={createBudget}
              disabled={creating || !newName.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Tworzenie…" : "Utwórz budżet"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((b) => {
            const totalBalance = (b.accounts ?? [])
              .filter((a) => a.isOnBudget)
              .reduce((s, a) => s + a.balance, 0);
            const privateGroup = (b.categoryGroups ?? []).find((g) => g.isPrivateExpenses);
            return (
              <Link
                key={b.id}
                href={`/dashboard/personal-budget/${b.id}`}
                className="block rounded-xl border border-border bg-card p-5 hover:border-accent/50 hover:bg-card-hover transition-colors"
              >
                <h2 className="font-semibold text-lg">{b.name}</h2>
                <p className="text-sm text-muted mt-1">
                  {(b.accounts ?? []).length} kont, {(b.categoryGroups ?? []).length} grup kategorii
                </p>
                <p className="mt-3 text-xl font-semibold">
                  {formatCurrency(totalBalance)}
                  <span className="text-sm font-normal text-muted ml-1">saldo ON_BUDGET</span>
                </p>
                {privateGroup && (
                  <span className="inline-block mt-2 text-xs rounded-full bg-accent-muted text-accent px-2 py-0.5">
                    Grupa „{privateGroup.name}”
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
