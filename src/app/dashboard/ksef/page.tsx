"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type KsefEnv = "prod" | "test";

export default function KsefPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [activeEnv, setActiveEnv] = useState<KsefEnv>("prod");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [fetchEnv, setFetchEnv] = useState<KsefEnv | "active">("active");

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    fetch("/api/ksef/status")
      .then((r) => r.json())
      .then((data) => {
        setConfigured(data.configured === true);
        setActiveEnv(data.activeEnv === "test" ? "test" : "prod");
      })
      .catch(() => setConfigured(false));
  }, []);

  async function handleFetch() {
    setMessage(null);
    setLoading(true);
    try {
      const envToUse = fetchEnv === "active" ? activeEnv : fetchEnv;
      const res = await fetch("/api/ksef/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          env: envToUse,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setMessage({ type: "error", text: data.error || "Błąd pobierania z KSEF" });
        return;
      }
      setMessage({
        type: "ok",
        text: `Zaimportowano ${data.imported ?? 0} faktur z KSEF.`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Integracja KSEF</h1>
      <p className="text-muted text-sm mb-6">
        Połączenie z Krajowym Systemem e-Faktur – pobieranie faktur i dodawanie ich do bazy.
      </p>

      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <h2 className="font-medium mb-2">Status połączenia</h2>
        {configured === null ? (
          <p className="text-muted text-sm">Sprawdzanie…</p>
        ) : configured ? (
          <p className="text-success text-sm">
            KSEF skonfigurowany (aktywne środowisko: <strong>{activeEnv === "prod" ? "Produkcja" : "Test"}</strong>)
          </p>
        ) : (
          <p className="text-warning text-sm">
            KSEF nie jest skonfigurowany dla aktywnego środowiska. Uzupełnij dane w{" "}
            <Link href="/dashboard/settings" className="text-accent hover:underline">Ustawieniach → Integracja KSEF</Link> (URL API i token).
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <h2 className="font-medium mb-4">Pobierz faktury z KSEF</h2>
        <p className="text-muted text-sm mb-4">
          Wybierz zakres dat i środowisko. Faktury zostaną pobrane i dodane do listy (duplikaty pomijane).
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-muted mb-1">Data od</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Data do</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Środowisko</label>
            <select
              value={fetchEnv}
              onChange={(e) => setFetchEnv(e.target.value as KsefEnv | "active")}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text"
            >
              <option value="active">Aktywne ({activeEnv === "prod" ? "Produkcja" : "Test"})</option>
              <option value="prod">Produkcja</option>
              <option value="test">Test</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleFetch}
            disabled={loading || !configured}
            className="rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Pobieranie…" : "Pobierz faktury z KSEF"}
          </button>
        </div>
        {message && (
          <p
            className={`mt-4 text-sm ${message.type === "ok" ? "text-success" : "text-red-400"}`}
          >
            {message.text}
          </p>
        )}
      </div>

      <p className="text-muted text-sm">
        <Link href="/dashboard/invoices" className="text-accent hover:underline">
          ← Lista faktur
        </Link>
        {" "}
        – tam możesz też użyć przycisku „Pobierz z KSEF” przy tej samej funkcji.
      </p>
    </div>
  );
}
