"use client";

import { Car, Loader2, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type TestResult = {
  ok: boolean;
  api: { ok: boolean; message: string; carCount?: number };
  telegram: { ok: boolean; message: string };
  files: { ok: boolean; message: string };
};

export default function TeslaScannerPage() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  async function runTest() {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/tesla-scanner/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Błąd");
      setResult(data);
    } catch (e) {
      setResult({
        ok: false,
        api: { ok: false, message: (e instanceof Error ? e.message : String(e)) },
        telegram: { ok: false, message: "-" },
        files: { ok: false, message: "-" },
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Car className="h-8 w-8" />
          <h1 className="text-2xl font-semibold">Tesla Scanner</h1>
        </div>
        <button
          onClick={runTest}
          disabled={testing}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-card disabled:opacity-50 flex items-center gap-2"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Testowanie…
            </>
          ) : (
            "Testuj konfigurację"
          )}
        </button>
      </div>

      {result && (
        <div
          className={`mb-6 rounded-xl border p-4 max-w-2xl ${
            result.ok ? "border-green-500/50 bg-green-500/5" : "border-amber-500/50 bg-amber-500/5"
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            {result.ok ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-amber-600" />
            )}
            <span className="font-medium">
              {result.ok ? "Wszystkie testy zaliczone" : "Niektóre testy nie powiodły się"}
            </span>
          </div>
          <ul className="space-y-1 text-sm">
            <li>
              <strong>API Tesli:</strong>{" "}
              <span className={result.api.ok ? "text-green-600" : "text-amber-600"}>
                {result.api.message}
              </span>
            </li>
            <li>
              <strong>Telegram:</strong>{" "}
              <span className={result.telegram.ok ? "text-green-600" : "text-amber-600"}>
                {result.telegram.message}
              </span>
            </li>
            <li>
              <strong>Pliki:</strong>{" "}
              <span className={result.files.ok ? "text-green-600" : "text-amber-600"}>
                {result.files.message}
              </span>
            </li>
          </ul>
          {!result.ok && (
            <div className="mt-4 pt-3 border-t border-border text-xs text-muted space-y-2">
              <p>
                <strong>HTTP 403:</strong> Tesla blokuje requesty z serwerów. Obejścia: (1) Ustaw{" "}
                <code>TESLA_PROXY_URL</code> – adres proxy HTTP (np. residential z Bright Data, Oxylabs).
                Format: <code>http://user:pass@host:port</code>. (2) Uruchom skrypt lokalnie:{" "}
                <code>npm run tesla-scan</code>
              </p>
              <p>
                <strong>Telegram:</strong> Upewnij się, że zmienne są w Coolify → Environment. "Bad
                Request: chat not found" = wyślij /start do bota przed testem. "Unauthorized" = zły
                token.
              </p>
            </div>
          )}
        </div>
      )}

      <p className="text-muted mb-4 max-w-2xl">
        Skrypt sprawdza dostępność nowych Tesli w polskim inventory (Model Y, PRAWD) i wysyła
        powiadomienia na Telegram, gdy pojawi się nowe auto. Używa oficjalnego API inventory Tesli.
      </p>
      <p className="text-amber-600 dark:text-amber-500 text-sm mb-4 max-w-2xl">
        Uwaga: Tesla czasem zwraca HTTP 403 z serwerów (np. Coolify). Obejścia: proxy (TESLA_PROXY_URL)
        lub uruchomienie skryptu lokalnie z sieci domowej.
      </p>

      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <h2 className="text-lg font-medium mb-3">Konfiguracja</h2>
        <p className="text-sm text-muted mb-3">
          Ustaw zmienne środowiskowe lub edytuj <code className="rounded bg-bg px-1 py-0.5 text-xs">scripts/tesla-scanner.ts</code>:
        </p>
        <ul className="text-sm space-y-1 list-disc list-inside text-muted">
          <li>
            <code className="rounded bg-bg px-1 py-0.5">TESLA_TELEGRAM_TOKEN</code> – token bota Telegram (od @BotFather)
          </li>
          <li>
            <code className="rounded bg-bg px-1 py-0.5">TESLA_TELEGRAM_CHAT_ID</code> – ID chatu (np. od @userinfobot)
          </li>
          <li>
            <code className="rounded bg-bg px-1 py-0.5">TESLA_PROXY_URL</code> – opcjonalnie: proxy HTTP przy 403 (np.{" "}
            <code>http://user:pass@host:port</code>)
          </li>
        </ul>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6 max-w-2xl">
        <h2 className="text-lg font-medium mb-3">Uruchamianie</h2>
        <p className="text-sm text-muted mb-2">Test (API + Telegram + pliki):</p>
        <pre className="rounded-lg bg-bg p-3 text-sm overflow-x-auto">
          npm run tesla-scan:test
        </pre>
        <p className="text-sm text-muted mt-4 mb-2">Skanowanie:</p>
        <pre className="rounded-lg bg-bg p-3 text-sm overflow-x-auto">
          npm run tesla-scan
        </pre>
        <p className="text-sm text-muted mt-4 mb-2">Tryb ciągły (skanowanie co 5 min):</p>
        <pre className="rounded-lg bg-bg p-3 text-sm overflow-x-auto">
          npm run tesla-scan:watch
        </pre>
        <p className="text-sm text-muted mt-4 mb-2">Automatycznie co 5 minut (cron):</p>
        <pre className="rounded-lg bg-bg p-3 text-sm overflow-x-auto">
          {"*/5 * * * * cd /ścieżka/do/projektu && npm run tesla-scan"}
        </pre>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6 max-w-2xl">
        <h2 className="text-lg font-medium mb-3">Strona monitorowana</h2>
        <a
          href="https://www.tesla.com/pl_PL/inventory/new/my?CATEGORY=PRAWD&arrangeby=plh&zip=00-510&range=0"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline text-sm break-all"
        >
          tesla.com/pl_PL/inventory/new/my?CATEGORY=PRAWD&arrangeby=plh&zip=00-510&range=0
        </a>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6 max-w-2xl">
        <h2 className="text-lg font-medium mb-3">Pliki</h2>
        <ul className="text-sm space-y-1 text-muted">
          <li>
            <code className="rounded bg-bg px-1 py-0.5">data/tesla_seen.json</code> – ID już znanych aut
          </li>
          <li>
            <code className="rounded bg-bg px-1 py-0.5">logs/tesla.log</code> – logi skanowania
          </li>
        </ul>
      </div>

      <div className="mt-6">
        <Link
          href="/dashboard"
          className="text-accent hover:underline text-sm"
        >
          ← Powrót do dashboardu
        </Link>
      </div>
    </div>
  );
}
