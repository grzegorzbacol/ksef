"use client";

import { useEffect, useState } from "react";

type KsefSettings = {
  apiUrl: string;
  token: string;
  queryPath: string;
  sendPath: string;
  nip: string;
};

const empty: KsefSettings = {
  apiUrl: "",
  token: "",
  queryPath: "",
  sendPath: "",
  nip: "",
};

export default function SettingsPage() {
  const [ksef, setKsef] = useState<KsefSettings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/ksef")
      .then((r) => r.json())
      .then((data) => {
        setKsef({
          apiUrl: data.apiUrl ?? "",
          token: data.token === "********" ? "" : (data.token ?? ""),
          queryPath: data.queryPath ?? "",
          sendPath: data.sendPath ?? "",
          nip: data.nip ?? "",
        });
      })
      .catch(() => setKsef(empty))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/ksef", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: ksef.apiUrl,
          token: ksef.token,
          queryPath: ksef.queryPath,
          sendPath: ksef.sendPath,
          nip: ksef.nip,
        }),
      });
      if (!res.ok) {
        setMessage({ type: "error", text: "Zapis nie powiódł się." });
        return;
      }
      setMessage({ type: "ok", text: "Ustawienia zapisane." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted">Ładowanie…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Ustawienia</h1>
      <p className="text-muted text-sm mb-6">
        Konfiguracja integracji z KSEF i inne parametry aplikacji.
      </p>

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <h2 className="font-medium mb-4">Integracja KSEF</h2>
        <p className="text-muted text-sm mb-4">
          Uzupełnij dane, aby aplikacja mogła łączyć się z KSEF. Wymagane minimum: URL API i token.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">URL API KSEF</label>
            <input
              type="url"
              value={ksef.apiUrl}
              onChange={(e) => setKsef((s) => ({ ...s, apiUrl: e.target.value }))}
              placeholder="https://api.ksef.mf.gov.pl"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Token (JWT)</label>
            <input
              type="password"
              value={ksef.token}
              onChange={(e) => setKsef((s) => ({ ...s, token: e.target.value }))}
              placeholder="Token z portalu KSEF"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              autoComplete="off"
            />
            <p className="text-xs text-muted mt-1">Pozostaw puste, aby nie zmieniać zapisanego tokenu.</p>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Ścieżka zapytania o faktury (opcjonalnie)</label>
            <input
              type="text"
              value={ksef.queryPath}
              onChange={(e) => setKsef((s) => ({ ...s, queryPath: e.target.value }))}
              placeholder="/api/online/Query/Invoice/Sync"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Ścieżka wysyłki faktury (opcjonalnie)</label>
            <input
              type="text"
              value={ksef.sendPath}
              onChange={(e) => setKsef((s) => ({ ...s, sendPath: e.target.value }))}
              placeholder="/api/online/Invoice/Send"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">NIP (opcjonalnie)</label>
            <input
              type="text"
              value={ksef.nip}
              onChange={(e) => setKsef((s) => ({ ...s, nip: e.target.value }))}
              placeholder="NIP sprzedawcy"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
        </div>

        {message && (
          <p className={`mt-4 text-sm ${message.type === "ok" ? "text-success" : "text-red-400"}`}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Zapisywanie…" : "Zapisz ustawienia"}
        </button>
      </form>
    </div>
  );
}
