"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type KsefSettings = {
  apiUrl: string;
  token: string;
  refreshToken: string;
  queryPath: string;
  sendPath: string;
  nip: string;
  invoicePdfPath: string;
};

type CompanySettings = {
  name: string;
  nip: string;
  address: string;
  postalCode: string;
  city: string;
};

type PaymentReminderSettings = {
  paymentReminderEmail: string;
  smtp: {
    host: string;
    port: string;
    user: string;
    password: string;
    from: string;
    secure: boolean;
  };
};

const emptyPaymentReminder: PaymentReminderSettings = {
  paymentReminderEmail: "grzegorz@bacol.pl",
  smtp: {
    host: "",
    port: "587",
    user: "",
    password: "",
    from: "",
    secure: true,
  },
};

const emptyKsef: KsefSettings = {
  apiUrl: "",
  token: "",
  refreshToken: "",
  queryPath: "",
  sendPath: "",
  nip: "",
  invoicePdfPath: "",
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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; error?: string; detail?: string } | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{ ok: boolean; error?: string; detail?: string } | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginResult, setLoginResult] = useState<{ ok: boolean; error?: string; detail?: string } | null>(null);
  const [paymentReminder, setPaymentReminder] = useState<PaymentReminderSettings>(emptyPaymentReminder);
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [showSmtp, setShowSmtp] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/ksef").then((r) => r.json()),
      fetch("/api/settings/company").then((r) => r.json()),
      fetch("/api/settings/payment-reminders").then((r) => r.json()),
    ])
      .then(([ksefData, companyData, reminderData]) => {
        setKsef({
          apiUrl: ksefData.apiUrl ?? "",
          token: ksefData.token === "********" ? "" : (ksefData.token ?? ""),
          refreshToken: ksefData.refreshToken === "********" ? "" : (ksefData.refreshToken ?? ""),
          queryPath: ksefData.queryPath ?? "",
          sendPath: ksefData.sendPath ?? "",
          nip: ksefData.nip ?? "",
          invoicePdfPath: ksefData.invoicePdfPath ?? "",
        });
        setCompany({
          name: companyData.name ?? "",
          nip: companyData.nip ?? "",
          address: companyData.address ?? "",
          postalCode: companyData.postalCode ?? "",
          city: companyData.city ?? "",
        });
        if (reminderData.paymentReminderEmail != null || reminderData.smtp) {
          setPaymentReminder({
            paymentReminderEmail: reminderData.paymentReminderEmail ?? emptyPaymentReminder.paymentReminderEmail,
            smtp: reminderData.smtp
              ? {
                  ...emptyPaymentReminder.smtp,
                  ...reminderData.smtp,
                  password: reminderData.smtp.password ?? "",
                }
              : emptyPaymentReminder.smtp,
          });
        }
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
          refreshToken: ksef.refreshToken,
          queryPath: ksef.queryPath,
          sendPath: ksef.sendPath,
          nip: ksef.nip,
          invoicePdfPath: ksef.invoicePdfPath,
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

      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl mb-8">
        <h2 className="font-medium mb-2">Faktury z maila</h2>
        <p className="text-muted text-sm mb-4">
          Ustawienia IMAP i import faktur z poczty e-mail.
        </p>
        <Link
          href="/dashboard/mail-invoices"
          className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90"
        >
          Otwórz Faktury z maila
        </Link>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setReminderMessage(null);
          setSavingReminder(true);
          try {
            const res = await fetch("/api/settings/payment-reminders", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentReminderEmail: paymentReminder.paymentReminderEmail,
                smtp: paymentReminder.smtp,
              }),
            });
            if (!res.ok) {
              setReminderMessage({ type: "error", text: "Zapis nie powiódł się." });
              return;
            }
            setReminderMessage({ type: "ok", text: "Ustawienia przypomnień zapisane." });
          } finally {
            setSavingReminder(false);
          }
        }}
        className="rounded-xl border border-border bg-card p-6 max-w-2xl mb-8"
      >
        <h2 className="font-medium mb-2">Przypomnienia o terminie płatności</h2>
        <p className="text-muted text-sm mb-4">
          W dniu terminu płatności rozrachunku zostanie wysłany e-mail na podany adres. Ustaw SMTP poniżej, aby włączyć wysyłkę.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">Adres e-mail na przypomnienia</label>
            <input
              type="email"
              value={paymentReminder.paymentReminderEmail}
              onChange={(e) =>
                setPaymentReminder((s) => ({ ...s, paymentReminderEmail: e.target.value }))
              }
              placeholder="grzegorz@bacol.pl"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowSmtp((v) => !v)}
              className="text-sm text-accent hover:underline"
            >
              {showSmtp ? "Ukryj ustawienia SMTP" : "Pokaż ustawienia SMTP (wysyłka e-mail)"}
            </button>
            {showSmtp && (
              <div className="mt-3 space-y-3 p-3 rounded-lg border border-border bg-bg/50">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1">Host SMTP</label>
                    <input
                      type="text"
                      value={paymentReminder.smtp.host}
                      onChange={(e) =>
                        setPaymentReminder((s) => ({
                          ...s,
                          smtp: { ...s.smtp, host: e.target.value },
                        }))
                      }
                      placeholder="smtp.example.com"
                      className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Port</label>
                    <input
                      type="text"
                      value={paymentReminder.smtp.port}
                      onChange={(e) =>
                        setPaymentReminder((s) => ({
                          ...s,
                          smtp: { ...s.smtp, port: e.target.value },
                        }))
                      }
                      placeholder="587"
                      className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Użytkownik SMTP</label>
                  <input
                    type="text"
                    value={paymentReminder.smtp.user}
                    onChange={(e) =>
                      setPaymentReminder((s) => ({
                        ...s,
                        smtp: { ...s.smtp, user: e.target.value },
                      }))
                    }
                    className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Hasło SMTP</label>
                  <input
                    type="password"
                    value={paymentReminder.smtp.password}
                    onChange={(e) =>
                      setPaymentReminder((s) => ({
                        ...s,
                        smtp: { ...s.smtp, password: e.target.value },
                      }))
                    }
                    placeholder="Pozostaw puste, aby nie zmieniać"
                    className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Adres nadawcy (From)</label>
                  <input
                    type="text"
                    value={paymentReminder.smtp.from}
                    onChange={(e) =>
                      setPaymentReminder((s) => ({
                        ...s,
                        smtp: { ...s.smtp, from: e.target.value },
                      }))
                    }
                    placeholder="aplikacja@example.com"
                    className="w-full rounded border border-border bg-bg px-2 py-1.5 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={paymentReminder.smtp.secure}
                    onChange={(e) =>
                      setPaymentReminder((s) => ({
                        ...s,
                        smtp: { ...s.smtp, secure: e.target.checked },
                      }))
                    }
                    className="rounded border-border"
                  />
                  Połączenie SSL/TLS
                </label>
              </div>
            )}
          </div>
        </div>
        {reminderMessage && (
          <p
            className={`mt-4 text-sm ${
              reminderMessage.type === "ok" ? "text-success" : "text-red-400"
            }`}
          >
            {reminderMessage.text}
          </p>
        )}
        <button
          type="submit"
          disabled={savingReminder}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
        >
          {savingReminder ? "Zapisywanie…" : "Zapisz przypomnienia"}
        </button>
      </form>

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
        <p className="text-muted text-sm mb-2">
          Uzupełnij dane, aby aplikacja mogła łączyć się z KSEF. Wymagane minimum: URL API i token.
        </p>
        <p className="text-muted text-xs mb-2">
          <strong>Kolejność:</strong> (1) Wklej w „Token” cały token z MCU (np. ref|nip-XXX|secret z portalu{" "}
          <a href="https://ksef.mf.gov.pl" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">ksef.mf.gov.pl</a>
          ). (2) Wpisz NIP. (3) Kliknij <strong>„Zaloguj tokenem KSeF”</strong> – w pole wpisze się token dostępu (JWT). (4) Kliknij „Zapisz ustawienia KSEF”. Dopiero potem „Sprawdź połączenie” – działa tylko z JWT w polu, nie z tokenem z MCU.
        </p>
        <p className="text-muted text-xs mb-4">
          Przy 401: upewnij się, że najpierw wykonałeś krok 3 (Zaloguj tokenem KSeF). W polu musi być JWT, nie surowy token z MCU.
          Po zapisaniu ustawień aplikacja zapisuje też refresh token – gdy access token wygaśnie, połączenie zostanie automatycznie odświeżone (bez ponownego logowania w portalu).
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
            <p className="text-xs text-muted mt-1">
              Wklej cały token z MCU (np. „ref|nip-XXX|secret” – ze spacjami lub bez) – aplikacja użyje właściwej części do szyfrowania. Podaj NIP i kliknij „Zaloguj tokenem KSeF”.
            </p>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">NIP (wymagany do logowania tokenem z MCU)</label>
            <input
              type="text"
              value={ksef.nip}
              onChange={(e) => setKsef((s) => ({ ...s, nip: e.target.value }))}
              placeholder="10 cyfr NIP"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
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
            <label className="block text-sm text-muted mb-1">Ścieżka pobierania PDF z KSEF (opcjonalnie)</label>
            <input
              type="text"
              value={ksef.invoicePdfPath}
              onChange={(e) => setKsef((s) => ({ ...s, invoicePdfPath: e.target.value }))}
              placeholder="/v2/invoices/ksef/{referenceNumber}"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
            <p className="text-muted text-xs mt-1">Użyj {"{referenceNumber}"} jako placeholder numeru KSEF. Domyślnie API 2.0 zwraca XML – aplikacja konwertuje go na PDF. Możesz podać własną ścieżkę do usługi zwracającej gotowy PDF.</p>
          </div>
        </div>

        {message && (
          <p className={`mt-4 text-sm ${message.type === "ok" ? "text-success" : "text-red-400"}`}>
            {message.text}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3 items-center">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Zapisywanie…" : "Zapisz ustawienia KSEF"}
          </button>
          <button
            type="button"
            disabled={loginLoading || !ksef.token.trim() || ksef.nip.replace(/\D/g, "").length !== 10}
            onClick={async () => {
              setLoginResult(null);
              setTestResult(null);
              setRedeemResult(null);
              setLoginLoading(true);
              try {
                const nip10 = ksef.nip.replace(/\D/g, "");
                const res = await fetch("/api/ksef/login-token", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    apiUrl: ksef.apiUrl || "https://api.ksef.mf.gov.pl",
                    token: ksef.token,
                    nip: nip10,
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (data.ok === true && data.accessToken) {
                  setKsef((s) => ({
                    ...s,
                    token: data.accessToken,
                    ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}),
                  }));
                  setLoginResult({ ok: true });
                } else {
                  setLoginResult({
                    ok: false,
                    error: data.error ?? "Logowanie nie powiodło się.",
                    detail: data.detail,
                  });
                }
              } catch {
                setLoginResult({ ok: false, error: "Błąd połączenia z serwerem." });
              } finally {
                setLoginLoading(false);
              }
            }}
            className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loginLoading ? "Logowanie…" : "Zaloguj tokenem KSeF"}
          </button>
          <button
            type="button"
            disabled={testing || !ksef.token.trim()}
            title={ksef.token.includes("|") ? "Najpierw użyj „Zaloguj tokenem KSeF” – w polu musi być JWT." : undefined}
            onClick={async () => {
              setTestResult(null);
              setRedeemResult(null);
              setLoginResult(null);
              setTesting(true);
              try {
                const res = await fetch("/api/ksef/test-connection", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ apiUrl: ksef.apiUrl || "https://api.ksef.mf.gov.pl", token: ksef.token }),
                });
                const data = await res.json().catch(() => ({}));
                setTestResult({
                  ok: data.ok === true,
                  message: data.message,
                  error: data.error,
                  detail: data.detail,
                });
              } catch {
                setTestResult({ ok: false, error: "Błąd połączenia z serwerem." });
              } finally {
                setTesting(false);
              }
            }}
            className="rounded-lg border border-border bg-bg px-4 py-2 text-text hover:bg-border disabled:opacity-50"
          >
            {testing ? "Sprawdzanie…" : "Sprawdź połączenie"}
          </button>
          <button
            type="button"
            disabled={redeeming || !ksef.token.trim()}
            onClick={async () => {
              setRedeemResult(null);
              setTestResult(null);
              setLoginResult(null);
              setRedeeming(true);
              try {
                const res = await fetch("/api/ksef/redeem-token", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ apiUrl: ksef.apiUrl || "https://api.ksef.mf.gov.pl", token: ksef.token }),
                });
                const data = await res.json().catch(() => ({}));
                if (data.ok === true && data.accessToken) {
                  setKsef((s) => ({
                    ...s,
                    token: data.accessToken,
                    ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}),
                  }));
                  setRedeemResult({ ok: true });
                } else {
                  setRedeemResult({
                    ok: false,
                    error: data.error ?? "Wymiana tokena nie powiodła się.",
                    detail: data.detail,
                  });
                }
              } catch {
                setRedeemResult({ ok: false, error: "Błąd połączenia z serwerem." });
              } finally {
                setRedeeming(false);
              }
            }}
            className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {redeeming ? "Wymiana…" : "Wymień token"}
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.ok ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}>
            {testResult.ok ? (
              <p>{testResult.message ?? "Połączenie z KSEF poprawne."}</p>
            ) : (
              <>
                <p>{testResult.error ?? "Błąd połączenia."}</p>
                {testResult.detail && <p className="mt-1 text-xs opacity-90">{testResult.detail}</p>}
              </>
            )}
          </div>
        )}
        {redeemResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${redeemResult.ok ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}>
            {redeemResult.ok ? (
              <p>Otrzymano token dostępu. Kliknij „Zapisz ustawienia KSEF”, aby zapisać token i refresh token (automatyczne odświeżanie przy 401).</p>
            ) : (
              <>
                <p>{redeemResult.error ?? "Wymiana tokena nie powiodła się."}</p>
                {redeemResult.detail && <p className="mt-1 text-xs opacity-90">{redeemResult.detail}</p>}
              </>
            )}
          </div>
        )}
        {loginResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${loginResult.ok ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}>
            {loginResult.ok ? (
              <p>Zalogowano. Token dostępu wpisany w pole powyżej. Kliknij „Zapisz ustawienia KSEF”, aby zapisać też refresh token (automatyczne odświeżanie przy wygaśnięciu).</p>
            ) : (
              <>
                <p>{loginResult.error ?? "Logowanie nie powiodło się."}</p>
                {loginResult.detail && <p className="mt-1 text-xs opacity-90">{loginResult.detail}</p>}
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
