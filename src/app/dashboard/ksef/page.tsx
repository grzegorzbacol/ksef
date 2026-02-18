"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function KsefPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    setDateFrom(from.toISOString().slice(0, 10));
    setDateTo(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    fetch("/api/ksef/status")
      .then((r) => r.json())
      .then((data) => setConfigured(data.configured === true))
      .catch(() => setConfigured(false));
  }, []);

  async function handleFetch() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ksef/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
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
          <p className="text-success text-sm">KSEF skonfigurowany (KSEF_API_URL, KSEF_TOKEN)</p>
        ) : (
          <p className="text-warning text-sm">
            KSEF nie jest skonfigurowany. Ustaw w zmiennych środowiskowych (np. w Coolify):{" "}
            <code className="bg-bg px-1 rounded">KSEF_API_URL</code> i{" "}
            <code className="bg-bg px-1 rounded">KSEF_TOKEN</code>.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <h2 className="font-medium mb-4">Pobierz faktury z KSEF</h2>
        <p className="text-muted text-sm mb-4">
          Wybierz zakres dat. Faktury z KSEF zostaną pobrane i dodane do listy faktur (duplikaty po numerze są pomijane).
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
