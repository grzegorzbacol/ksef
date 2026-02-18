"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MailSettings = {
  imapHost: string;
  imapPort: string;
  imapUser: string;
  imapPassword: string;
  imapSecure: boolean;
  imapFolder: string;
  emailAddress: string;
};

export default function MailInvoicesPage() {
  const [settings, setSettings] = useState<MailSettings>({
    imapHost: "",
    imapPort: "993",
    imapUser: "",
    imapPassword: "",
    imapSecure: true,
    imapFolder: "INBOX",
    emailAddress: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/mail")
      .then((r) => r.json())
      .then((d) => {
        setSettings({
          imapHost: d.imapHost ?? "",
          imapPort: d.imapPort ?? "993",
          imapUser: d.imapUser ?? "",
          imapPassword: d.imapPassword === "********" ? "" : (d.imapPassword ?? ""),
          imapSecure: d.imapSecure !== false,
          imapFolder: d.imapFolder ?? "INBOX",
          emailAddress: d.emailAddress ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/mail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
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

  async function handleFetch() {
    setMessage(null);
    setFetching(true);
    try {
      const res = await fetch("/api/mail/fetch", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setMessage({
          type: "ok",
          text: `Zaimportowano ${data.imported ?? 0} faktur z maila.`,
        });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Błąd pobierania z skrzynki e-mail.",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Błąd połączenia." });
    } finally {
      setFetching(false);
    }
  }

  if (loading) return <p className="text-muted">Ładowanie…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Faktury z maila</h1>
      <p className="text-muted text-sm mb-6">
        Skonfiguruj skrzynkę IMAP, na którą przychodzą faktury. Kliknij „Pobierz maile” – aplikacja
        odczyta wiadomości z ostatnich 90 dni, wyciągnie dane z załączników (XML FA, PDF) i doda
        faktury do listy zakupów ze źródłem „Mail”.
      </p>

      <form onSubmit={handleSave} className="rounded-xl border border-border bg-card p-6 max-w-2xl mb-8">
        <h2 className="font-medium mb-4">Ustawienia IMAP</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">Serwer IMAP</label>
            <input
              type="text"
              value={settings.imapHost}
              onChange={(e) => setSettings((s) => ({ ...s, imapHost: e.target.value }))}
              placeholder="imap.example.com"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">Port</label>
              <input
                type="text"
                value={settings.imapPort}
                onChange={(e) => setSettings((s) => ({ ...s, imapPort: e.target.value }))}
                placeholder="993"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.imapSecure}
                  onChange={(e) => setSettings((s) => ({ ...s, imapSecure: e.target.checked }))}
                />
                <span className="text-sm">SSL/TLS</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Użytkownik (e-mail)</label>
            <input
              type="text"
              value={settings.imapUser}
              onChange={(e) => setSettings((s) => ({ ...s, imapUser: e.target.value }))}
              placeholder="konto@example.com"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Hasło</label>
            <input
              type="password"
              value={settings.imapPassword}
              onChange={(e) => setSettings((s) => ({ ...s, imapPassword: e.target.value }))}
              placeholder="••••••••"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              autoComplete="off"
            />
            <p className="text-xs text-muted mt-1">
              Dla Gmaila użyj hasła aplikacji (2FA). Dla innych – zwykłe hasło lub hasło aplikacji.
            </p>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Folder (opcjonalnie)</label>
            <input
              type="text"
              value={settings.imapFolder}
              onChange={(e) => setSettings((s) => ({ ...s, imapFolder: e.target.value }))}
              placeholder="INBOX"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Adres e-mail (na który przychodzą faktury)</label>
            <input
              type="text"
              value={settings.emailAddress}
              onChange={(e) => setSettings((s) => ({ ...s, emailAddress: e.target.value }))}
              placeholder="faktury@firma.pl"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
            <p className="text-xs text-muted mt-1">Informacyjnie – do identyfikacji skrzynki.</p>
          </div>
        </div>
        {message && (
          <p className={`mt-4 text-sm ${message.type === "ok" ? "text-success" : "text-red-400"}`}>
            {message.text}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Zapisywanie…" : "Zapisz ustawienia"}
          </button>
          <button
            type="button"
            onClick={handleFetch}
            disabled={fetching || !settings.imapHost || !settings.imapUser || !settings.imapPassword}
            className="rounded-lg border border-border bg-bg px-4 py-2 text-text hover:border-accent disabled:opacity-50"
          >
            {fetching ? "Pobieranie…" : "Pobierz maile"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-medium mb-2">Faktury pobrane z maila</h2>
        <p className="text-muted text-sm mb-4">
          Faktury ze źródłem „Mail” trafiają do listy <Link href="/dashboard/invoices-sales" className="text-accent hover:underline">Faktury zakupu</Link>.
          W tabeli możesz: <strong>edytować numer faktury</strong> (kliknij numer przy fakturze z maila), <strong>edytować dostawcę</strong> (kliknij nazwę dostawcy) lub <strong>przypisać kontrahenta z bazy</strong> (dropdown), oraz <strong>ustawić jako opłaconą</strong> (checkbox w kolumnie „Rozliczono”).
          Kliknij „Szczegóły” przy fakturze, aby zobaczyć treść maila, załączniki, zmienić numer lub dostawcę, przypisać kontrahenta lub oznaczyć płatność.
        </p>
        <Link href="/dashboard/invoices-sales" className="text-accent hover:underline">
          → Przejdź do faktur zakupu
        </Link>
      </div>
    </div>
  );
}
