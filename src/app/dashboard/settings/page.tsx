"use client";

import { useEffect, useState } from "react";

type KsefSettings = {
  apiUrl: string;
  token: string;
  queryPath: string;
  sendPath: string;
  nip: string;
};

type CompanySettings = {
  name: string;
  nip: string;
  address: string;
  postalCode: string;
  city: string;
};

const emptyKsef: KsefSettings = {
  apiUrl: "",
  token: "",
  queryPath: "",
  sendPath: "",
  nip: "",
};

const emptyCompany: CompanySettings = {
  name: "",
  nip: "",
  address: "",
  postalCode: "",
  city: "",
};

export default function SettingsPage() {
  const [ksef, setKsef] = useState<KsefSettings>(emptyKsef);
  const [company, setCompany] = useState<CompanySettings>(emptyCompany);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [companyMessage, setCompanyMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/ksef").then((r) => r.json()),
      fetch("/api/settings/company").then((r) => r.json()),
    ])
      .then(([ksefData, companyData]) => {
        setKsef({
          apiUrl: ksefData.apiUrl ?? "",
          token: ksefData.token === "********" ? "" : (ksefData.token ?? ""),
          queryPath: ksefData.queryPath ?? "",
          sendPath: ksefData.sendPath ?? "",
          nip: ksefData.nip ?? "",
        });
        setCompany({
          name: companyData.name ?? "",
          nip: companyData.nip ?? "",
          address: companyData.address ?? "",
          postalCode: companyData.postalCode ?? "",
          city: companyData.city ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleKsefSubmit(e: React.FormEvent) {
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
      setMessage({ type: "ok", text: "Ustawienia KSEF zapisane." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCompanySubmit(e: React.FormEvent) {
    e.preventDefault();
    setCompanyMessage(null);
    setSavingCompany(true);
    try {
      const res = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      });
      if (!res.ok) {
        setCompanyMessage({ type: "error", text: "Zapis nie powiódł się." });
        return;
      }
      setCompanyMessage({ type: "ok", text: "Dane firmy zapisane." });
    } finally {
      setSavingCompany(false);
    }
  }

  if (loading) return <p className="text-muted">Ładowanie…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Ustawienia</h1>
      <p className="text-muted text-sm mb-6">
        Konfiguracja integracji z KSEF, dane firmy (wystawcy faktur) i inne parametry.
      </p>

      <form onSubmit={handleCompanySubmit} className="rounded-xl border border-border bg-card p-6 max-w-2xl mb-8">
        <h2 className="font-medium mb-4">Dane firmy (sprzedawcy)</h2>
        <p className="text-muted text-sm mb-4">
          Dane firmy wystawiającej faktury. Będą używane domyślnie przy tworzeniu nowej faktury.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">Nazwa firmy</label>
            <input
              type="text"
              value={company.name}
              onChange={(e) => setCompany((s) => ({ ...s, name: e.target.value }))}
              placeholder="Nazwa spółki / działalności"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">NIP</label>
            <input
              type="text"
              value={company.nip}
              onChange={(e) => setCompany((s) => ({ ...s, nip: e.target.value }))}
              placeholder="NIP"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Adres</label>
            <input
              type="text"
              value={company.address}
              onChange={(e) => setCompany((s) => ({ ...s, address: e.target.value }))}
              placeholder="Ulica, numer"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">Kod pocztowy</label>
              <input
                type="text"
                value={company.postalCode}
                onChange={(e) => setCompany((s) => ({ ...s, postalCode: e.target.value }))}
                placeholder="00-000"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Miasto</label>
              <input
                type="text"
                value={company.city}
                onChange={(e) => setCompany((s) => ({ ...s, city: e.target.value }))}
                placeholder="Miasto"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              />
            </div>
          </div>
        </div>
        {companyMessage && (
          <p className={`mt-4 text-sm ${companyMessage.type === "ok" ? "text-success" : "text-red-400"}`}>
            {companyMessage.text}
          </p>
        )}
        <button
          type="submit"
          disabled={savingCompany}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
        >
          {savingCompany ? "Zapisywanie…" : "Zapisz dane firmy"}
        </button>
      </form>

      <form onSubmit={handleKsefSubmit} className="rounded-xl border border-border bg-card p-6 max-w-2xl">
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
              placeholder="/v2/invoices/query/metadata"
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
          {saving ? "Zapisywanie…" : "Zapisz ustawienia KSEF"}
        </button>
      </form>
    </div>
  );
}
