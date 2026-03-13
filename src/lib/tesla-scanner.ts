/**
 * Tesla Inventory Scanner – logika współdzielona (CLI + API)
 */

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SEEN_FILE = path.join(DATA_DIR, "tesla_seen.json");
const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "tesla.log");

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/html, */*",
  "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
  Referer: "https://www.tesla.com/pl_PL/inventory/new/my",
};

export type TeslaCar = {
  id: string;
  model: string;
  price: string;
  link: string;
};

export type TestResult = {
  ok: boolean;
  api: { ok: boolean; message: string; carCount?: number };
  telegram: { ok: boolean; message: string };
  files: { ok: boolean; message: string };
};

function log(message: string): void {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${message}\n`;
  if (typeof process !== "undefined" && process.stdout?.write) {
    process.stdout.write(line);
  }
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line);
  } catch {
    // ignore
  }
}

export async function fetchInventoryPage(): Promise<string> {
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
      log("HTTP 403: Tesla może blokować requesty.");
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

export function parseCars(json: string): TeslaCar[] {
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

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token = process.env.TESLA_TELEGRAM_TOKEN ?? "";
  const chatId = process.env.TESLA_TELEGRAM_CHAT_ID ?? "";
  if (!token || !chatId) {
    log("Brak konfiguracji Telegram");
    return false;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = new URLSearchParams({
    chat_id: chatId,
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
    log("Błąd Telegram: " + (await res.text()));
    return false;
  }
  return true;
}

export async function runTest(): Promise<TestResult> {
  const result: TestResult = {
    ok: true,
    api: { ok: false, message: "" },
    telegram: { ok: false, message: "" },
    files: { ok: false, message: "" },
  };

  try {
    const json = await fetchInventoryPage();
    const cars = parseCars(json);
    result.api = { ok: true, message: `OK – znaleziono ${cars.length} aut`, carCount: cars.length };
  } catch (e) {
    result.api = { ok: false, message: (e instanceof Error ? e.message : String(e)) };
    result.ok = false;
  }

  const token = process.env.TESLA_TELEGRAM_TOKEN ?? "";
  const chatId = process.env.TESLA_TELEGRAM_CHAT_ID ?? "";
  if (token && chatId) {
    const testMsg =
      "🧪 <b>Tesla Scanner – test</b>\nJeśli widzisz tę wiadomość, powiadomienia działają.";
    const sent = await sendTelegramMessage(testMsg);
    result.telegram = sent
      ? { ok: true, message: "OK – wiadomość testowa wysłana" }
      : { ok: false, message: "Nie udało się wysłać" };
    result.ok = result.ok && sent;
  } else {
    result.telegram = { ok: false, message: "Brak TESLA_TELEGRAM_TOKEN lub TESLA_TELEGRAM_CHAT_ID" };
  }

  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, "");
    result.files = { ok: true, message: "OK – data/ i logs/ zapisywalne" };
  } catch (e) {
    result.files = { ok: false, message: (e instanceof Error ? e.message : String(e)) };
    result.ok = false;
  }

  return result;
}
