/**
 * Tesla Inventory Scanner
 * Sprawdza dostępność Tesli w inventory i wysyła powiadomienia Telegram o nowych autach.
 * Uruchamiać co 5 minut (np. cron co 5 min)
 */

import fs from "fs";
import path from "path";
import { runTest } from "@/lib/tesla-scanner";

// --- Konfiguracja ---
// Ustaw w .env lub podaj tutaj (nie commituj tokena!):
// const telegramToken = "TWÓJ_TOKEN";
// const telegramChatId = "TWÓJ_CHAT_ID";
const telegramToken = process.env.TESLA_TELEGRAM_TOKEN ?? "";
const telegramChatId = process.env.TESLA_TELEGRAM_CHAT_ID ?? "";

const INVENTORY_URL =
  "https://www.tesla.com/pl_PL/inventory/new/my?CATEGORY=PRAWD&arrangeby=plh&zip=00-510&range=0";

const DATA_DIR = path.join(process.cwd(), "data");
const SEEN_FILE = path.join(DATA_DIR, "tesla_seen.json");
const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "tesla.log");

type TeslaCar = {
  id: string;
  model: string;
  price: string;
  link: string;
};

// --- Logging ---
function log(message: string): void {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${message}\n`;
  process.stdout.write(line);
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // ignore write errors
  }
}

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/html, */*",
  "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
  Referer: "https://www.tesla.com/pl_PL/inventory/new/my",
};

// --- Pobieranie danych (API inventory – HTML jest blokowany) ---
async function fetchInventoryPage(): Promise<string> {
  const apiQuery = encodeURIComponent(
    JSON.stringify({
      query: {
        model: "my",
        condition: "new",
        market: "PL",
        language: "pl",
        arrangeby: "Price",
        order: "asc",
        zip: "00-510",
        range: 0,
        super_region: "europe",
      },
      offset: 0,
      count: 50,
      outsideOffset: 0,
      outsideSearch: false,
    })
  );
  const apiUrl = `https://www.tesla.com/inventory/api/v1/inventory-results?query=${apiQuery}`;
  const res = await fetch(apiUrl, { headers: DEFAULT_HEADERS });
  if (!res.ok) {
    if (res.status === 403) {
      log("HTTP 403: Tesla może blokować requesty. Spróbuj z innej sieci lub użyj proxy.");
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

// --- Parsowanie listy aut z JSON API ---
function parseCars(json: string): TeslaCar[] {
  const cars: TeslaCar[] = [];
  try {
    const data = JSON.parse(json) as { results?: Array<Record<string, unknown>> };
    const results = data?.results ?? [];
    for (const r of results) {
      const id = (r.VIN ?? r.ID ?? r.vin ?? r.id ?? "") as string;
      if (!id) continue;
      const model = ((r.Model ?? r.TrimName ?? r.model) as string) ?? "Tesla Model Y";
      const priceVal = (r.InventoryPrice ?? r.Price ?? r.inventoryPrice ?? r.price ?? 0) as number;
      const price =
        typeof priceVal === "number"
          ? `${(priceVal / 1000).toFixed(0)} 000 PLN`
          : String(priceVal);
      const link =
        (r.Url as string) ?? `https://www.tesla.com/pl_PL/inventory/new/my?VIN=${id}`;
      cars.push({ id, model, price, link });
    }
  } catch (e) {
    log("Błąd parsowania JSON: " + (e instanceof Error ? e.message : String(e)));
  }
  return cars;
}

// --- Wysyłanie wiadomości Telegram ---
async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!telegramToken || !telegramChatId) {
    log("Brak konfiguracji Telegram (TESLA_TELEGRAM_TOKEN, TESLA_TELEGRAM_CHAT_ID)");
    return false;
  }
  const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
  const body = new URLSearchParams({
    chat_id: telegramChatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: "true",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    log("Błąd Telegram: " + err);
    return false;
  }
  return true;
}

// --- Wczytanie/zapis seen ---
function loadSeen(): Record<string, boolean> {
  try {
    const raw = fs.readFileSync(SEEN_FILE, "utf8");
    const data = JSON.parse(raw);
    return typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function saveSeen(seen: Record<string, boolean>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2), "utf8");
  } catch (e) {
    log("Błąd zapisu tesla_seen.json: " + (e instanceof Error ? e.message : String(e)));
  }
}

// --- Główna logika ---
async function run(): Promise<void> {
  log("Start skanowania Tesla inventory...");
  const seen = loadSeen();

  let json: string;
  try {
    json = await fetchInventoryPage();
  } catch (e) {
    log("Błąd pobierania danych: " + (e instanceof Error ? e.message : String(e)));
    return;
  }

  const cars = parseCars(json);
  log(`Znaleziono ${cars.length} aut w inventory.`);

  let newCount = 0;
  for (const car of cars) {
    if (seen[car.id]) continue;
    seen[car.id] = true;
    newCount++;
    const msg = [
      "🆕 <b>Nowa Tesla w inventory</b>",
      `Model: ${car.model}`,
      `Cena: ${car.price}`,
      `Link: ${car.link}`,
    ].join("\n");
    const ok = await sendTelegramMessage(msg);
    if (ok) log(`Wysłano powiadomienie: ${car.model} (${car.id})`);
    else log(`Nie udało się wysłać: ${car.id}`);
  }

  saveSeen(seen);
  log(`Koniec. Nowych aut: ${newCount}.`);
}

const WATCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minut

async function main(): Promise<void> {
  const watch = process.argv.includes("--watch");
  const test = process.argv.includes("--test");

  if (test) {
    log("=== Test konfiguracji Tesla Scanner ===");
    const res = await runTest();
    log("---");
    console.log(JSON.stringify(res));
    process.exit(res.ok ? 0 : 1);
  }

  if (watch) {
    log("Tryb watch: skanowanie co 5 minut.");
    while (true) {
      await run();
      await new Promise((r) => setTimeout(r, WATCH_INTERVAL_MS));
    }
  } else {
    await run();
  }
}

main().catch((e) => {
  log("Błąd: " + (e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
