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
  pitRate: number;
  healthRate: number;
  isVatPayer: boolean;
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
  pitRate: 0.12,
  healthRate: 0.09,
  isVatPayer: true,
};

type Car = {
  id: string;
  name: string;
  value: number;
  limit100k: number;
  limit150k: number;
  limit200k: number;
  vatDeductionPercent: number;
  sortOrder: number;
};

type ExpenseCategory = {
  id: string;
  name: string;
  sortOrder: number;
};

type KsefEnv = "prod" | "test";

export default function SettingsPage() {
  const [ksefProd, setKsefProd] = useState<KsefSettings>(emptyKsef);
  const [ksefTest, setKsefTest] = useState<KsefSettings>(emptyKsef);
  const [ksefActiveEnv, setKsefActiveEnv] = useState<KsefEnv>("prod");
  const [company, setCompany] = useState<CompanySettings>(emptyCompany);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [companyMessage, setCompanyMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [testingFor, setTestingFor] = useState<KsefEnv | null>(null);
  const [testResult, setTestResult] = useState<{ for: KsefEnv; ok: boolean; message?: string; error?: string; detail?: string } | null>(null);
  const [redeemingFor, setRedeemingFor] = useState<KsefEnv | null>(null);
  const [redeemResult, setRedeemResult] = useState<{ for: KsefEnv; ok: boolean; error?: string; detail?: string } | null>(null);
  const [loginLoadingFor, setLoginLoadingFor] = useState<KsefEnv | null>(null);
  const [loginResult, setLoginResult] = useState<{ for: KsefEnv; ok: boolean; error?: string; detail?: string } | null>(null);
  const [paymentReminder, setPaymentReminder] = useState<PaymentReminderSettings>(emptyPaymentReminder);
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [showSmtp, setShowSmtp] = useState(false);
  const [carForm, setCarForm] = useState({
    name: "",
    value: "150000",
    limit100k: "100000",
    limit150k: "150000",
    limit200k: "200000",
    vatDeductionPercent: "0.5" as "0.5" | "1",
  });
  const [savingCar, setSavingCar] = useState(false);
  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [deletingCarId, setDeletingCarId] = useState<string | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [categoryFormName, setCategoryFormName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  type RecurringPurchaseInvoice = {
    id: string;
    name: string;
    dayOfMonth: number;
    sellerName: string;
    sellerNip: string;
    expenseCategoryId: string | null;
    expenseCategory?: { id: string; name: string } | null;
    sortOrder: number;
  };
  const [recurringPurchaseInvoices, setRecurringPurchaseInvoices] = useState<RecurringPurchaseInvoice[]>([]);
  const [rpiForm, setRpiForm] = useState({
    name: "",
    dayOfMonth: "10",
    sellerName: "",
    sellerNip: "",
    expenseCategoryId: "",
  });
  const [savingRpi, setSavingRpi] = useState(false);
  const [editingRpiId, setEditingRpiId] = useState<string | null>(null);
  const [deletingRpiId, setDeletingRpiId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/ksef").then((r) => r.json()),
      fetch("/api/settings/company").then((r) => r.json()),
      fetch("/api/settings/payment-reminders").then((r) => r.json()),
      fetch("/api/cars").then((r) => r.json()).then((data) => setCars(Array.isArray(data) ? data : [])).catch(() => setCars([])),
      fetch("/api/expense-categories").then((r) => r.json()).then((data) => setExpenseCategories(Array.isArray(data) ? data : [])).catch(() => setExpenseCategories([])),
      fetch("/api/recurring-purchase-invoices").then((r) => r.json()).then((data) => setRecurringPurchaseInvoices(Array.isArray(data) ? data : [])).catch(() => setRecurringPurchaseInvoices([])),
    ])
      .then(([ksefData, companyData, reminderData]) => {
        const fill = (d: Record<string, unknown>) => ({
          apiUrl: (d.apiUrl as string) ?? "",
          token: (d.token as string) === "********" ? "" : ((d.token as string) ?? ""),
          refreshToken: (d.refreshToken as string) === "********" ? "" : ((d.refreshToken as string) ?? ""),
          queryPath: (d.queryPath as string) ?? "",
          sendPath: (d.sendPath as string) ?? "",
          nip: (d.nip as string) ?? "",
          invoicePdfPath: (d.invoicePdfPath as string) ?? "",
        });
        setKsefProd(fill(ksefData.prod ?? ksefData));
        setKsefTest(fill(ksefData.test ?? emptyKsef));
        setKsefActiveEnv(ksefData.activeEnv === "test" ? "test" : "prod");
        setCompany({
          name: companyData.name ?? "",
          nip: companyData.nip ?? "",
          address: companyData.address ?? "",
          postalCode: companyData.postalCode ?? "",
          city: companyData.city ?? "",
          pitRate: companyData.pitRate != null ? Number(companyData.pitRate) : 0.12,
          healthRate: companyData.healthRate != null ? Number(companyData.healthRate) : 0.09,
          isVatPayer: companyData.isVatPayer !== false && String(companyData.isVatPayer) !== "false",
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
          activeEnv: ksefActiveEnv,
          prod: ksefProd,
          test: ksefTest,
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

  if (loading) return <p className="text-content-text-secondary">Ładowanie…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2 text-content-text">Ustawienia</h1>
      <p className="text-content-text-secondary text-sm mb-6">
        Konfiguracja integracji z KSEF, dane firmy (wystawcy faktur) i inne parametry.
      </p>

      <div className="rounded-xl border border-content-border bg-white p-6 max-w-2xl mb-8 shadow-sm">
        <h2 className="font-medium mb-2 text-content-text">Faktury z maila</h2>
        <p className="text-content-text-secondary text-sm mb-4">
          Ustawienia IMAP i import faktur z poczty e-mail.
        </p>
        <Link
          href="/dashboard/mail-invoices"
          className="inline-flex items-center rounded-lg px-4 py-2 text-white font-medium hover:opacity-90"
          style={{ backgroundColor: "var(--accent)" }}
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
        className="rounded-xl border border-content-border bg-white p-6 max-w-2xl mb-8 shadow-sm"
      >
        <h2 className="font-medium mb-2 text-content-text">Przypomnienia o terminie płatności</h2>
        <p className="text-content-text-secondary text-sm mb-4">
          W dniu terminu płatności rozrachunku zostanie wysłany e-mail na podany adres. Ustaw SMTP poniżej, aby włączyć wysyłkę.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-content-text-secondary mb-1">Adres e-mail na przypomnienia</label>
            <input
              type="email"
              value={paymentReminder.paymentReminderEmail}
              onChange={(e) =>
                setPaymentReminder((s) => ({ ...s, paymentReminderEmail: e.target.value }))
              }
              placeholder="grzegorz@bacol.pl"
              className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowSmtp((v) => !v)}
              className="text-sm font-medium text-accent hover:underline"
            >
              {showSmtp ? "Ukryj ustawienia SMTP" : "Pokaż ustawienia SMTP (wysyłka e-mail)"}
            </button>
            {showSmtp && (
              <div className="mt-3 space-y-3 p-3 rounded-lg border border-content-border bg-gray-50">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-content-text-secondary mb-1">Host SMTP</label>
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
                      className="w-full rounded border border-content-border bg-white px-2 py-1.5 text-sm text-content-text"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-content-text-secondary mb-1">Port</label>
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
                      className="w-full rounded border border-content-border bg-white px-2 py-1.5 text-sm text-content-text"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-content-text-secondary mb-1">Użytkownik SMTP</label>
                  <input
                    type="text"
                    value={paymentReminder.smtp.user}
                    onChange={(e) =>
                      setPaymentReminder((s) => ({
                        ...s,
                        smtp: { ...s.smtp, user: e.target.value },
                      }))
                    }
                    className="w-full rounded border border-content-border bg-white px-2 py-1.5 text-sm text-content-text"
                  />
                </div>
                <div>
                  <label className="block text-xs text-content-text-secondary mb-1">Hasło SMTP</label>
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
                    className="w-full rounded border border-content-border bg-white px-2 py-1.5 text-sm text-content-text"
                  />
                </div>
                <div>
                  <label className="block text-xs text-content-text-secondary mb-1">Adres nadawcy (From)</label>
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
                    className="w-full rounded border border-content-border bg-white px-2 py-1.5 text-sm text-content-text"
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
                    className="rounded border-content-border"
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
          className="mt-4 rounded-lg px-4 py-2 text-white font-medium hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)" }}
        >
          {savingReminder ? "Zapisywanie…" : "Zapisz przypomnienia"}
        </button>
      </form>

      <form onSubmit={handleCompanySubmit} className="rounded-xl border border-content-border bg-white p-6 max-w-2xl mb-8 shadow-sm">
        <h2 className="font-medium mb-4 text-content-text">Dane firmy (sprzedawcy)</h2>
        <p className="text-content-text-secondary text-sm mb-4">
          Dane firmy wystawiającej faktury. Będą używane domyślnie przy tworzeniu nowej faktury.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-content-text-secondary mb-1">Nazwa firmy</label>
            <input
              type="text"
              value={company.name}
              onChange={(e) => setCompany((s) => ({ ...s, name: e.target.value }))}
              placeholder="Nazwa spółki / działalności"
              className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
            />
          </div>
          <div>
            <label className="block text-sm text-content-text-secondary mb-1">NIP</label>
            <input
              type="text"
              value={company.nip}
              onChange={(e) => setCompany((s) => ({ ...s, nip: e.target.value }))}
              placeholder="NIP"
              className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
            />
          </div>
          <div>
            <label className="block text-sm text-content-text-secondary mb-1">Adres</label>
            <input
              type="text"
              value={company.address}
              onChange={(e) => setCompany((s) => ({ ...s, address: e.target.value }))}
              placeholder="Ulica, numer"
              className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-content-text-secondary mb-1">Kod pocztowy</label>
              <input
                type="text"
                value={company.postalCode}
                onChange={(e) => setCompany((s) => ({ ...s, postalCode: e.target.value }))}
                placeholder="00-000"
                className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
              />
            </div>
            <div>
              <label className="block text-sm text-content-text-secondary mb-1">Miasto</label>
              <input
                type="text"
                value={company.city}
                onChange={(e) => setCompany((s) => ({ ...s, city: e.target.value }))}
                placeholder="Miasto"
                className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
              />
            </div>
          </div>
          <div className="border-t border-content-border pt-4 mt-4">
            <h3 className="font-medium mb-2 text-content-text">Korzyści podatkowe (faktury zakupu)</h3>
            <p className="text-content-text-secondary text-sm mb-3">
              Stawki używane w module „Korzyści podatkowe” do obliczania VAT do odzyskania, oszczędności PIT i składki zdrowotnej oraz realnego kosztu faktury.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-content-text-secondary mb-1">Stawka PIT (skala podatkowa)</label>
                <select
                  value={company.pitRate === 0.32 ? "0.32" : "0.12"}
                  onChange={(e) =>
                    setCompany((s) => ({ ...s, pitRate: e.target.value === "0.32" ? 0.32 : 0.12 }))
                  }
                  className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
                >
                  <option value="0.12">12%</option>
                  <option value="0.32">32%</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-content-text-secondary mb-1">Stawka składki zdrowotnej</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={company.healthRate}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) setCompany((s) => ({ ...s, healthRate: Math.max(0, Math.min(1, v)) }));
                  }}
                  className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text max-w-[120px]"
                />
                <span className="text-content-text-secondary text-sm ml-2">np. 0.09 = 9%</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={company.isVatPayer}
                  onChange={(e) => setCompany((s) => ({ ...s, isVatPayer: e.target.checked }))}
                  className="rounded border-content-border"
                />
                <span className="text-sm">Jestem płatnikiem VAT (VAT do odzyskania z faktur zakupu)</span>
              </label>
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
          className="mt-4 rounded-lg px-4 py-2 text-white font-medium hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)" }}
        >
          {savingCompany ? "Zapisywanie…" : "Zapisz dane firmy"}
        </button>
      </form>

      <div className="rounded-xl border border-content-border bg-white p-6 max-w-3xl mb-8 shadow-sm">
        <h2 className="font-medium mb-2 text-content-text">Samochody (wydatki na pojazd)</h2>
        <p className="text-content-text-secondary text-sm mb-4">
          Definicje samochodów do oznaczania faktur zakupu. Wartość pojazdu i limity odliczenia (progi 100 / 150 / 200 tys. PLN) oraz % odliczenia VAT (50% lub 100%). Przepisy się zmieniają – limity można edytować.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = carForm.name.trim();
            if (!name) {
              alert("Podaj nazwę samochodu.");
              return;
            }
            const value = parseFloat(carForm.value);
            if (Number.isNaN(value) || value < 0) {
              alert("Podaj poprawną wartość (PLN).");
              return;
            }
            setSavingCar(true);
            const payload = {
              name,
              value,
              limit100k: parseFloat(carForm.limit100k) || 100000,
              limit150k: parseFloat(carForm.limit150k) || 150000,
              limit200k: parseFloat(carForm.limit200k) || 200000,
              vatDeductionPercent: carForm.vatDeductionPercent === "1" ? 1 : 0.5,
            };
            try {
              if (editingCarId) {
                const res = await fetch(`/api/cars/${editingCarId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                if (!res.ok) {
                  const d = await res.json().catch(() => ({}));
                  alert(d.error || "Błąd zapisu");
                  return;
                }
                const updated = await res.json();
                setCars((prev) => prev.map((c) => (c.id === editingCarId ? updated : c)));
              } else {
                const res = await fetch("/api/cars", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                if (!res.ok) {
                  const d = await res.json().catch(() => ({}));
                  alert(d.error || "Błąd zapisu");
                  return;
                }
                const created = await res.json();
                setCars((prev) => [...prev, created].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
              }
              setEditingCarId(null);
              setCarForm({
                name: "",
                value: "150000",
                limit100k: "100000",
                limit150k: "150000",
                limit200k: "200000",
                vatDeductionPercent: "0.5",
              });
            } finally {
              setSavingCar(false);
            }
          }}
          className="space-y-3 mb-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-content-text-secondary mb-1">Nazwa (np. Skoda Octavia)</label>
              <input
                type="text"
                value={carForm.name}
                onChange={(e) => setCarForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nazwa samochodu"
                className="w-full rounded border border-content-border bg-white px-3 py-2 text-sm text-content-text"
              />
            </div>
            <div>
              <label className="block text-xs text-content-text-secondary mb-1">Wartość (PLN)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={carForm.value}
                onChange={(e) => setCarForm((f) => ({ ...f, value: e.target.value }))}
                className="w-full rounded border border-content-border bg-white px-3 py-2 text-sm text-content-text"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-content-text-secondary mb-1">Limit do 100 tys. (PLN)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={carForm.limit100k}
                onChange={(e) => setCarForm((f) => ({ ...f, limit100k: e.target.value }))}
                className="w-full rounded border border-content-border bg-white px-3 py-2 text-sm text-content-text"
              />
            </div>
            <div>
              <label className="block text-xs text-content-text-secondary mb-1">Limit 100–150 tys. (PLN)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={carForm.limit150k}
                onChange={(e) => setCarForm((f) => ({ ...f, limit150k: e.target.value }))}
                className="w-full rounded border border-content-border bg-white px-3 py-2 text-sm text-content-text"
              />
            </div>
            <div>
              <label className="block text-xs text-content-text-secondary mb-1">Limit pow. 150 tys. (PLN)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={carForm.limit200k}
                onChange={(e) => setCarForm((f) => ({ ...f, limit200k: e.target.value }))}
                className="w-full rounded border border-content-border bg-white px-3 py-2 text-sm text-content-text"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs text-content-text-secondary mb-1">Odliczenie VAT</label>
              <select
                value={carForm.vatDeductionPercent}
                onChange={(e) => setCarForm((f) => ({ ...f, vatDeductionPercent: e.target.value as "0.5" | "1" }))}
                className="rounded border border-content-border bg-white px-3 py-2 text-sm text-content-text"
              >
                <option value="0.5">50%</option>
                <option value="1">100%</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={savingCar || !carForm.name.trim()}
              className="rounded-lg px-4 py-2 text-white font-medium hover:opacity-90 disabled:opacity-50 text-sm mt-6"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {savingCar ? "Zapisywanie…" : editingCarId ? "Zapisz zmiany" : "Dodaj samochód"}
            </button>
            {editingCarId && (
              <button
                type="button"
                onClick={() => {
                  setEditingCarId(null);
                  setCarForm({
                    name: "",
                    value: "150000",
                    limit100k: "100000",
                    limit150k: "150000",
                    limit200k: "200000",
                    vatDeductionPercent: "0.5",
                  });
                }}
                className="rounded border border-content-border px-4 py-2 text-sm mt-6 text-content-text hover:bg-gray-100"
              >
                Anuluj
              </button>
            )}
          </div>
        </form>
        {cars.length > 0 && (
          <div className="border-t border-content-border pt-4">
            <h3 className="font-medium mb-2 text-content-text">Lista samochodów</h3>
            <ul className="space-y-2">
              {cars.map((car) => (
                <li
                  key={car.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-content-border bg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{car.name}</span>
                    <span className="text-content-text-secondary">
                    wartość: {car.value.toLocaleString("pl-PL")} PLN, limit: {car.value <= 100000 ? car.limit100k : car.value <= 150000 ? car.limit150k : car.limit200k} PLN, VAT {(car.vatDeductionPercent * 100).toFixed(0)}%
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCarId(car.id);
                        setCarForm({
                          name: car.name,
                          value: String(car.value),
                          limit100k: String(car.limit100k),
                          limit150k: String(car.limit150k),
                          limit200k: String(car.limit200k),
                          vatDeductionPercent: car.vatDeductionPercent === 1 ? "1" : "0.5",
                        });
                      }}
                      className="text-accent font-medium text-sm hover:underline"
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      disabled={deletingCarId === car.id}
                      onClick={async () => {
                        if (!confirm(`Usunąć samochód „${car.name}"?`)) return;
                        setDeletingCarId(car.id);
                        try {
                          const res = await fetch(`/api/cars/${car.id}`, { method: "DELETE" });
                          if (res.ok) setCars((prev) => prev.filter((c) => c.id !== car.id));
                          else alert("Błąd usuwania");
                        } finally {
                          setDeletingCarId(null);
                        }
                      }}
                      className="text-red-600 font-medium text-sm hover:underline disabled:opacity-50"
                    >
                      Usuń
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-content-border bg-white p-6 max-w-3xl mb-8 shadow-sm">
        <h2 className="font-medium mb-2 text-content-text">Kategorie kosztów (faktury zakupu)</h2>
        <p className="text-content-text-secondary text-sm mb-4">
          Definiuj kategorie, do których można przypisywać faktury zakupu (np. Biuro, Marketing, Usługi IT).
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = categoryFormName.trim();
            if (!name) {
              alert("Podaj nazwę kategorii.");
              return;
            }
            setSavingCategory(true);
            try {
              if (editingCategoryId) {
                const res = await fetch(`/api/expense-categories/${editingCategoryId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name }),
                });
                if (!res.ok) {
                  const d = await res.json().catch(() => ({}));
                  alert(d.error || "Błąd zapisu");
                  return;
                }
                const updated = await res.json();
                setExpenseCategories((prev) => prev.map((c) => (c.id === editingCategoryId ? updated : c)));
              } else {
                const res = await fetch("/api/expense-categories", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name }),
                });
                if (!res.ok) {
                  const d = await res.json().catch(() => ({}));
                  alert(d.error || "Błąd zapisu");
                  return;
                }
                const created = await res.json();
                setExpenseCategories((prev) => [...prev, created].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
              }
              setEditingCategoryId(null);
              setCategoryFormName("");
            } finally {
              setSavingCategory(false);
            }
          }}
          className="flex flex-wrap gap-2 mb-4"
        >
          <input
            type="text"
            value={categoryFormName}
            onChange={(e) => setCategoryFormName(e.target.value)}
            placeholder="Nazwa kategorii (np. Biuro)"
            className="rounded border border-content-border bg-white px-3 py-2 text-sm text-content-text min-w-[200px]"
          />
          <button
            type="submit"
            disabled={savingCategory || !categoryFormName.trim()}
            className="rounded-lg px-4 py-2 text-white font-medium hover:opacity-90 disabled:opacity-50 text-sm"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {savingCategory ? "Zapisywanie…" : editingCategoryId ? "Zapisz" : "Dodaj kategorię"}
          </button>
          {editingCategoryId && (
            <button
              type="button"
              onClick={() => {
                setEditingCategoryId(null);
                setCategoryFormName("");
              }}
              className="rounded border border-content-border px-4 py-2 text-sm text-content-text hover:bg-gray-100"
            >
              Anuluj
            </button>
          )}
        </form>
        {expenseCategories.length > 0 && (
          <div className="border-t border-content-border pt-4">
            <h3 className="font-medium mb-2 text-content-text">Lista kategorii</h3>
            <ul className="space-y-2">
              {expenseCategories.map((cat) => (
                <li
                  key={cat.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-content-border bg-gray-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{cat.name}</span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(cat.id);
                        setCategoryFormName(cat.name);
                      }}
                      className="text-accent font-medium text-sm hover:underline"
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      disabled={deletingCategoryId === cat.id}
                      onClick={async () => {
                        if (!confirm(`Usunąć kategorię „${cat.name}"? Faktury z tą kategorią zostaną od niej odłączone.`)) return;
                        setDeletingCategoryId(cat.id);
                        try {
                          const res = await fetch(`/api/expense-categories/${cat.id}`, { method: "DELETE" });
                          if (res.ok) setExpenseCategories((prev) => prev.filter((c) => c.id !== cat.id));
                          else alert("Błąd usuwania");
                        } finally {
                          setDeletingCategoryId(null);
                        }
                      }}
                      className="text-red-600 font-medium text-sm hover:underline disabled:opacity-50"
                    >
                      Usuń
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-content-border bg-white p-6 max-w-3xl mb-8 shadow-sm">
        <h2 className="font-medium mb-2 text-content-text">Cykliczne faktury zakupu</h2>
        <p className="text-content-text-secondary text-sm mb-4">
          Szablony faktur wystawianych cyklicznie (np. co 10. dnia miesiąca). Dla każdego miesiąca tworzona jest pusta faktura z datą wystawienia – uzupełnisz pozycje i kwoty później.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = rpiForm.name.trim();
            const sellerName = rpiForm.sellerName.trim();
            const sellerNip = rpiForm.sellerNip.trim();
            const dayOfMonth = parseInt(rpiForm.dayOfMonth, 10);
            if (!name || !sellerName || !sellerNip || isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
              alert("Wypełnij nazwę, dostawcę (NIP) i dzień miesiąca (1–31).");
              return;
            }
            setSavingRpi(true);
            try {
              if (editingRpiId) {
                const res = await fetch(`/api/recurring-purchase-invoices/${editingRpiId}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name,
                    dayOfMonth,
                    sellerName,
                    sellerNip,
                    expenseCategoryId: rpiForm.expenseCategoryId || null,
                  }),
                });
                if (!res.ok) {
                  const d = await res.json().catch(() => ({}));
                  alert(d.error || "Błąd zapisu");
                  return;
                }
                const updated = await res.json();
                setRecurringPurchaseInvoices((prev) =>
                  prev.map((r) => (r.id === editingRpiId ? updated : r))
                );
                setEditingRpiId(null);
              } else {
                const res = await fetch("/api/recurring-purchase-invoices", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name,
                    dayOfMonth,
                    sellerName,
                    sellerNip,
                    expenseCategoryId: rpiForm.expenseCategoryId || null,
                  }),
                });
                if (!res.ok) {
                  const d = await res.json().catch(() => ({}));
                  alert(d.error || "Błąd zapisu");
                  return;
                }
                const created = await res.json();
                setRecurringPurchaseInvoices((prev) => [...prev, created].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
              }
              setRpiForm({ name: "", dayOfMonth: "10", sellerName: "", sellerNip: "", expenseCategoryId: "" });
            } finally {
              setSavingRpi(false);
            }
          }}
          className="flex flex-wrap gap-3 mb-4"
        >
          <input
            type="text"
            value={rpiForm.name}
            onChange={(e) => setRpiForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nazwa (np. Abonament biurowy)"
            className="rounded border border-content-border bg-white px-3 py-2 text-sm text-content-text min-w-[160px]"
          />
          <input
            type="number"
            min={1}
            max={31}
            value={rpiForm.dayOfMonth}
            onChange={(e) => setRpiForm((f) => ({ ...f, dayOfMonth: e.target.value }))}
            placeholder="Dzień miesiąca"
            className="rounded border border-content-border bg-white px-3 py-2 text-sm text-content-text w-24"
            title="Dzień miesiąca wystawienia (1–31)"
          />
          <input
            type="text"
            value={rpiForm.sellerName}
            onChange={(e) => setRpiForm((f) => ({ ...f, sellerName: e.target.value }))}
            placeholder="Dostawca"
            className="rounded border border-content-border bg-white px-3 py-2 text-sm text-content-text min-w-[140px]"
          />
          <input
            type="text"
            value={rpiForm.sellerNip}
            onChange={(e) => setRpiForm((f) => ({ ...f, sellerNip: e.target.value }))}
            placeholder="NIP dostawcy"
            className="rounded border border-content-border bg-white px-3 py-2 text-sm text-content-text w-32"
          />
          <select
            value={rpiForm.expenseCategoryId}
            onChange={(e) => setRpiForm((f) => ({ ...f, expenseCategoryId: e.target.value }))}
            className="rounded border border-content-border bg-white px-3 py-2 text-sm text-content-text min-w-[120px]"
          >
            <option value="">Kategoria (opcjonalnie)</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={savingRpi || !rpiForm.name.trim() || !rpiForm.sellerName.trim() || !rpiForm.sellerNip.trim()}
            className="rounded-lg px-4 py-2 text-white font-medium hover:opacity-90 disabled:opacity-50 text-sm"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {savingRpi ? "Zapisywanie…" : editingRpiId ? "Zapisz" : "Dodaj szablon"}
          </button>
          {editingRpiId && (
            <button
              type="button"
              onClick={() => {
                setEditingRpiId(null);
                setRpiForm({ name: "", dayOfMonth: "10", sellerName: "", sellerNip: "", expenseCategoryId: "" });
              }}
              className="rounded border border-content-border px-4 py-2 text-sm text-content-text hover:bg-gray-100"
            >
              Anuluj
            </button>
          )}
        </form>
        {recurringPurchaseInvoices.length > 0 && (
          <div className="border-t border-content-border pt-4">
            <h3 className="font-medium mb-2 text-content-text">Szablony</h3>
            <ul className="space-y-2">
              {recurringPurchaseInvoices.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-content-border bg-gray-50 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{r.name}</span>
                    <span className="text-content-text-secondary ml-2">
                      – {r.sellerName} (NIP {r.sellerNip}), dzień {r.dayOfMonth}.
                      {r.expenseCategory ? ` Kategoria: ${r.expenseCategory.name}` : ""}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRpiId(r.id);
                        setRpiForm({
                          name: r.name,
                          dayOfMonth: String(r.dayOfMonth),
                          sellerName: r.sellerName,
                          sellerNip: r.sellerNip,
                          expenseCategoryId: r.expenseCategoryId || "",
                        });
                      }}
                      className="text-accent font-medium text-sm hover:underline"
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      disabled={deletingRpiId === r.id}
                      onClick={async () => {
                        if (!confirm(`Usunąć szablon „${r.name}"? Istniejące faktury nie zostaną usunięte.`)) return;
                        setDeletingRpiId(r.id);
                        try {
                          const res = await fetch(`/api/recurring-purchase-invoices/${r.id}`, { method: "DELETE" });
                          if (res.ok) setRecurringPurchaseInvoices((prev) => prev.filter((x) => x.id !== r.id));
                          else alert("Błąd usuwania");
                        } finally {
                          setDeletingRpiId(null);
                        }
                      }}
                      className="text-red-600 font-medium text-sm hover:underline disabled:opacity-50"
                    >
                      Usuń
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-content-text-secondary text-xs mt-2">
              Faktury generowane są automatycznie przy wejściu na stronę Faktury zakupu oraz 1. dnia miesiąca (cron).
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleKsefSubmit} className="rounded-xl border border-content-border bg-white p-6 max-w-2xl shadow-sm">
        <h2 className="font-medium mb-4 text-content-text">Integracja KSEF</h2>
        <p className="text-content-text-secondary text-sm mb-2">
          Możesz skonfigurować dwa połączenia: <strong>produkcyjne</strong> (api.ksef.mf.gov.pl) i <strong>testowe</strong> (api-demo.ksef.mf.gov.pl). Aktywne środowisko jest używane przy pobieraniu faktur i wysyłce.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-content-text-secondary">Aktywne środowisko:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="ksef_active"
              checked={ksefActiveEnv === "prod"}
              onChange={() => setKsefActiveEnv("prod")}
              className="rounded-full"
            />
            <span>Produkcja</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="ksef_active"
              checked={ksefActiveEnv === "test"}
              onChange={() => setKsefActiveEnv("test")}
              className="rounded-full"
            />
            <span>Test</span>
          </label>
        </div>
        <details className="text-content-text-secondary text-xs mb-4">
          <summary className="cursor-pointer text-accent hover:underline">Pomoc: logowanie tokenem z MCU</summary>
          <p className="mt-2">(1) Wklej token z MCU (portal ksef.mf.gov.pl). (2) Wpisz NIP. (3) Kliknij „Zaloguj tokenem KSeF”. (4) Zapisz ustawienia.</p>
          <ul className="mt-2 list-disc list-inside">
            <li><strong>Produkcja:</strong> https://api.ksef.mf.gov.pl</li>
            <li><strong>Test:</strong> https://api-demo.ksef.mf.gov.pl</li>
          </ul>
        </details>
        <details className="text-content-text-secondary text-xs mb-4">
          <summary className="cursor-pointer text-accent hover:underline">Wysyłka faktur (KSeF 2.0)</summary>
          <p className="mt-2">Oficjalne KSeF 2.0 nie ma prostego endpointu JSON – wymaga sesji, szyfrowania XML itd. <strong>Alternatywa:</strong> KSeFAPI.dev – URL <code>https://demo.ksefapi.dev</code>, ścieżka <code>/api/invoices</code>. Zarejestruj firmę, ustaw token i wyślij faktury w formacie JSON.</p>
        </details>

        {(["prod", "test"] as KsefEnv[]).map((env) => {
          const ksef = env === "prod" ? ksefProd : ksefTest;
          const setKsef = env === "prod" ? setKsefProd : setKsefTest;
          const defaultUrl = env === "prod" ? "https://api.ksef.mf.gov.pl" : "https://api-demo.ksef.mf.gov.pl";
          const title = env === "prod" ? "KSeF Produkcja" : "KSeF Test";
          return (
            <details key={env} open={env === "prod"} className="mb-6 border border-content-border rounded-lg overflow-hidden">
              <summary className="cursor-pointer bg-gray-100 px-4 py-3 font-medium text-content-text hover:bg-gray-200">
                {title}
              </summary>
              <div className="p-4 pt-2 space-y-4 border-t border-content-border bg-white">
                <div>
                  <label className="block text-sm text-content-text-secondary mb-1">URL API KSEF</label>
                  <input
                    type="url"
                    value={ksef.apiUrl}
                    onChange={(e) => setKsef((s) => ({ ...s, apiUrl: e.target.value }))}
                    placeholder={defaultUrl}
                    className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
                  />
                </div>
                <div>
                  <label className="block text-sm text-content-text-secondary mb-1">Token (JWT)</label>
                  <input
                    type="password"
                    value={ksef.token}
                    onChange={(e) => setKsef((s) => ({ ...s, token: e.target.value }))}
                    placeholder="Token z portalu KSEF"
                    className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm text-content-text-secondary mb-1">NIP</label>
                  <input
                    type="text"
                    value={ksef.nip}
                    onChange={(e) => setKsef((s) => ({ ...s, nip: e.target.value }))}
                    placeholder="10 cyfr NIP"
                    className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-content-text-secondary mb-1">Ścieżka zapytania (opcjonalnie)</label>
                    <input
                      type="text"
                      value={ksef.queryPath}
                      onChange={(e) => setKsef((s) => ({ ...s, queryPath: e.target.value }))}
                      placeholder="/v2/invoices/query/metadata"
                      className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-content-text-secondary mb-1">Ścieżka wysyłki (opcjonalnie)</label>
                    <input
                      type="text"
                      value={ksef.sendPath}
                      onChange={(e) => setKsef((s) => ({ ...s, sendPath: e.target.value }))}
                      placeholder="/api/online/Invoice/Send"
                      className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-content-text-secondary mb-1">Ścieżka PDF (opcjonalnie)</label>
                  <input
                    type="text"
                    value={ksef.invoicePdfPath}
                    onChange={(e) => setKsef((s) => ({ ...s, invoicePdfPath: e.target.value }))}
                    placeholder="/v2/invoices/ksef/{referenceNumber}"
                    className="w-full rounded-lg border border-content-border bg-white px-3 py-2 text-content-text"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={loginLoadingFor !== null || !ksef.token.trim() || ksef.nip.replace(/\D/g, "").length !== 10}
                    onClick={async () => {
                      setLoginResult(null); setTestResult(null); setRedeemResult(null);
                      setLoginLoadingFor(env);
                      try {
                        const nip10 = ksef.nip.replace(/\D/g, "");
                        const res = await fetch("/api/ksef/login-token", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ apiUrl: ksef.apiUrl || defaultUrl, token: ksef.token, nip: nip10 }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (data.ok === true && data.accessToken) {
                          const updated = { ...ksef, token: data.accessToken, ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}) };
                          setKsef((s) => ({ ...s, token: data.accessToken, ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}) }));
                          if (env === "test") setKsefActiveEnv("test");
                          const saveRes = await fetch("/api/settings/ksef", {
                            method: "PUT", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              activeEnv: env,
                              prod: env === "prod" ? updated : ksefProd,
                              test: env === "test" ? updated : ksefTest,
                            }),
                          });
                          if (saveRes.ok) setMessage({ type: "ok", text: "Zalogowano i zapisano token." });
                          setLoginResult({ for: env, ok: true });
                        } else setLoginResult({ for: env, ok: false, error: data.error ?? "Błąd", detail: data.detail });
                      } catch {
                        setLoginResult({ for: env, ok: false, error: "Błąd połączenia." });
                      } finally {
                        setLoginLoadingFor(null);
                      }
                    }}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-white text-sm hover:bg-amber-700 disabled:opacity-50"
                  >
                    {loginLoadingFor === env ? "Logowanie…" : "Zaloguj tokenem KSeF"}
                  </button>
                  <button
                    type="button"
                    disabled={testingFor !== null || !ksef.token.trim()}
                    onClick={async () => {
                      setTestResult(null); setLoginResult(null); setRedeemResult(null);
                      setTestingFor(env);
                      try {
                        const res = await fetch("/api/ksef/test-connection", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ apiUrl: ksef.apiUrl || defaultUrl, token: ksef.token }),
                        });
                        const data = await res.json().catch(() => ({}));
                        setTestResult({ for: env, ok: data.ok === true, message: data.message, error: data.error, detail: data.detail });
                      } catch {
                        setTestResult({ for: env, ok: false, error: "Błąd połączenia." });
                      } finally {
                        setTestingFor(null);
                      }
                    }}
                    className="rounded-lg border border-content-border bg-white px-3 py-1.5 text-sm text-content-text font-medium hover:bg-gray-100 disabled:opacity-50"
                  >
                    {testingFor === env ? "Sprawdzanie…" : "Sprawdź połączenie"}
                  </button>
                  <button
                    type="button"
                    disabled={redeemingFor !== null || !ksef.token.trim()}
                    onClick={async () => {
                      setRedeemResult(null); setTestResult(null); setLoginResult(null);
                      setRedeemingFor(env);
                      try {
                        const res = await fetch("/api/ksef/redeem-token", {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ apiUrl: ksef.apiUrl || defaultUrl, token: ksef.token }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (data.ok === true && data.accessToken) {
                          const updated = { ...ksef, token: data.accessToken, ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}) };
                          setKsef((s) => ({ ...s, token: data.accessToken, ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}) }));
                          if (env === "test") setKsefActiveEnv("test");
                          const saveRes = await fetch("/api/settings/ksef", {
                            method: "PUT", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              activeEnv: env,
                              prod: env === "prod" ? updated : ksefProd,
                              test: env === "test" ? updated : ksefTest,
                            }),
                          });
                          if (saveRes.ok) setMessage({ type: "ok", text: "Token wymieniony i zapisany." });
                          setRedeemResult({ for: env, ok: true });
                        } else setRedeemResult({ for: env, ok: false, error: data.error ?? "Błąd", detail: data.detail });
                      } catch {
                        setRedeemResult({ for: env, ok: false, error: "Błąd połączenia." });
                      } finally {
                        setRedeemingFor(null);
                      }
                    }}
                    className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 font-medium hover:bg-amber-100 disabled:opacity-50"
                  >
                    {redeemingFor === env ? "Wymiana…" : "Wymień token"}
                  </button>
                </div>
                {testResult?.for === env && (
                  <div className={`p-3 rounded-lg text-sm ${testResult.ok ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}>
                    {testResult.ok ? <p>{testResult.message ?? "Połączenie poprawne."}</p> : <><p>{testResult.error}</p>{testResult.detail && <p className="text-xs mt-1">{testResult.detail}</p>}</>}
                  </div>
                )}
                {loginResult?.for === env && (
                  <div className={`p-3 rounded-lg text-sm ${loginResult.ok ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}>
                    {loginResult.ok ? <p>Zalogowano i zapisano token.</p> : <><p>{loginResult.error}</p>{loginResult.detail && <p className="text-xs mt-1">{loginResult.detail}</p>}</>}
                  </div>
                )}
                {redeemResult?.for === env && (
                  <div className={`p-3 rounded-lg text-sm ${redeemResult.ok ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}>
                    {redeemResult.ok ? <p>Token wymieniony i zapisany.</p> : <><p>{redeemResult.error}</p>{redeemResult.detail && <p className="text-xs mt-1">{redeemResult.detail}</p>}</>}
                  </div>
                )}
              </div>
            </details>
          );
        })}

        {message && (
          <p className={`mt-4 text-sm ${message.type === "ok" ? "text-success" : "text-red-400"}`}>
            {message.text}
          </p>
        )}
        <div className="mt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg px-4 py-2 text-white font-medium hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {saving ? "Zapisywanie…" : "Zapisz ustawienia KSEF"}
          </button>
        </div>
      </form>
    </div>
  );
}
