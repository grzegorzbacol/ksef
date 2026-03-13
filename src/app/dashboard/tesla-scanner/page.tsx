"use client";

import { Car } from "lucide-react";
import Link from "next/link";

export default function TeslaScannerPage() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Car className="h-8 w-8" />
        <h1 className="text-2xl font-semibold">Tesla Scanner</h1>
      </div>

      <p className="text-muted mb-4 max-w-2xl">
        Skrypt sprawdza dostępność nowych Tesli w polskim inventory (Model Y, PRAWD) i wysyła
        powiadomienia na Telegram, gdy pojawi się nowe auto. Używa oficjalnego API inventory Tesli.
      </p>
      <p className="text-amber-600 dark:text-amber-500 text-sm mb-4 max-w-2xl">
        Uwaga: Tesla czasem zwraca HTTP 403 dla zautomatyzowanych zapytań. Przy 403 uruchom skrypt
        z sieci domowej lub w innej lokalizacji.
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
        </ul>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6 max-w-2xl">
        <h2 className="text-lg font-medium mb-3">Uruchamianie</h2>
        <p className="text-sm text-muted mb-2">Ręcznie:</p>
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
