/**
 * Tesla Inventory Scanner – logika współdzielona (CLI + API)
 */

import axios, { AxiosError } from "axios";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SEEN_FILE = path.join(DATA_DIR, "tesla_seen.json");
const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "tesla.log");

const TESLA_API_URL = "https://www.tesla.com/inventory/api/v1/inventory-results";
const TESLA_PAGE_URL =
  "https://www.tesla.com/pl_PL/inventory/new/my?CATEGORY=PRAWD&arrangeby=plh&zip=00-510&range=0";

const API_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  "Content-Type": "application/json",
  Accept: "application/json",
};

const API_BODY = {
  query: {
    model: "my",
    condition: "new",
    options: {
      Region: "PL",
      Zip: "00-510",
      Range: 0,
    },
    arrangeby: "Price",
    order: "asc",
  },
};

const REQUEST_TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 3;

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

async function fetchViaScrapingBee(): Promise<string> {
  const key = process.env.TESLA_SCRAPINGBEE_KEY?.trim();
  if (!key) return "";
  try {
    const url = `https://app.scrapingbee.com/api/v1/?api_key=${key}&url=${encodeURIComponent(TESLA_PAGE_URL)}&render_js=true&wait=3000`;
    const res = await axios.get(url, {
      timeout: 30000,
      responseType: "text",
    });
    return res.status === 200 ? (res.data as string) : "";
  } catch {
    return "";
  }
}

function extractJsonFromHtml(html: string): string | null {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]) as Record<string, unknown>;
    const props = data?.props as Record<string, unknown> | undefined;
    const pageProps = props?.["pageProps"] as Record<string, unknown> | undefined;
    const state = pageProps?.initialState as Record<string, unknown> | undefined;
    const inv = state?.inventory as Record<string, unknown> | undefined;
    const invData = inv?.inventory as { results?: unknown[] } | undefined;
    const results = invData?.results ?? [];
    if (results.length === 0) return null;
    return JSON.stringify({ results });
  } catch {
    return null;
  }
}

/**
 * Pobiera dane inventory Tesli. Najpierw POST do API, przy 403 – fallback ScrapingBee (TESLA_SCRAPINGBEE_KEY).
 * Retry 3x, timeout 10s.
 */
export async function fetchTeslaInventory(): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await axios.post(TESLA_API_URL, API_BODY, {
        headers: API_HEADERS,
        timeout: REQUEST_TIMEOUT_MS,
        responseType: "text",
        validateStatus: () => true,
      });

      if (res.status === 200) return res.data as string;

      const msg = `HTTP ${res.status} (próba ${attempt}/${MAX_RETRIES})`;
      log(`Błąd API Tesli: ${msg}`);
      lastError = new Error(msg);

      if (res.status === 403 && attempt === MAX_RETRIES) {
        log("Próba fallback ScrapingBee...");
        try {
          const html = await fetchViaScrapingBee();
          if (html) {
            const cars = extractCarsFromHtml(html);
            if (cars.length > 0) {
              log("ScrapingBee OK – zwracam dane z HTML");
              return JSON.stringify({ results: cars.map((c) => ({ VIN: c.id, Model: c.model, InventoryPrice: c.price, Url: c.link })) });
            }
          }
        } catch (e) {
          log("ScrapingBee nie powiódł się: " + (e instanceof Error ? e.message : String(e)));
        }
      }

      if (attempt < MAX_RETRIES && (res.status === 403 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw lastError;
    } catch (e) {
      const is403 = e instanceof AxiosError && e.response?.status === 403;
      const isNetwork = e instanceof AxiosError && !e.response;
      const isTimeout = e instanceof AxiosError && e.code === "ECONNABORTED";

      lastError = e instanceof Error ? e : new Error(String(e));
      const errMsg = e instanceof AxiosError
        ? (e.response ? `HTTP ${e.response.status}` : e.message)
        : lastError.message;

      log(`Błąd API Tesli (próba ${attempt}/${MAX_RETRIES}): ${errMsg}`);

      const shouldRetry = (is403 || isNetwork || isTimeout) && attempt < MAX_RETRIES;
      if (shouldRetry) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        if (attempt === MAX_RETRIES && (is403 || isNetwork)) {
          log("Próba fallback ScrapingBee...");
          try {
            const html = await fetchViaScrapingBee();
            const json = html ? extractJsonFromHtml(html) : null;
            if (json) {
              log("ScrapingBee OK");
              return json;
            }
          } catch {
            // ignore
          }
        }
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Nie udało się pobrać danych");
}

/**
 * Parsuje JSON z API inventory – wyciąga VIN, model, cenę, link.
 */
export function parseCars(json: string): TeslaCar[] {
  const cars: TeslaCar[] = [];

  try {
    const data = JSON.parse(json) as { results?: Array<Record<string, unknown>> };
    const results = data?.results ?? [];

    for (const r of results) {
      const vin = (r.VIN ?? r.vin ?? r.ID ?? r.id ?? "") as string;
      if (!vin) continue;
      const model = ((r.Model ?? r.TrimName ?? r.model) as string) ?? "Tesla Model Y";
      const priceVal = (r.InventoryPrice ?? r.Price ?? r.inventoryPrice ?? r.price ?? 0) as number;
      const price =
        typeof priceVal === "number"
          ? `${(priceVal / 1000).toFixed(0)} 000 PLN`
          : String(priceVal);
      const link =
        (r.Url as string) ?? `https://www.tesla.com/pl_PL/inventory/new/my?VIN=${vin}`;
      cars.push({ id: vin, model, price, link });
    }
  } catch (e) {
    log("Błąd parsowania JSON: " + (e instanceof Error ? e.message : String(e)));
  }
  return cars;
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const r = await sendTelegramMessageWithError(text);
  return r.ok;
}

async function sendTelegramMessageWithError(
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TESLA_TELEGRAM_TOKEN ?? "";
  const chatId = process.env.TESLA_TELEGRAM_CHAT_ID ?? "";
  if (!token || !chatId) {
    log("Brak konfiguracji Telegram");
    return { ok: false, error: "Brak TESLA_TELEGRAM_TOKEN lub TESLA_TELEGRAM_CHAT_ID" };
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
  const responseText = await res.text();
  if (!res.ok) {
    log("Błąd Telegram: " + responseText);
    let errMsg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(responseText) as { description?: string };
      if (j.description) errMsg = j.description;
    } catch {
      if (responseText) errMsg = responseText.slice(0, 200);
    }
    return { ok: false, error: errMsg };
  }
  return { ok: true };
}

export async function runTest(): Promise<TestResult> {
  const result: TestResult = {
    ok: true,
    api: { ok: false, message: "" },
    telegram: { ok: false, message: "" },
    files: { ok: false, message: "" },
  };

  try {
    const json = await fetchTeslaInventory();
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
    const r = await sendTelegramMessageWithError(testMsg);
    result.telegram = r.ok
      ? { ok: true, message: "OK – wiadomość testowa wysłana" }
      : { ok: false, message: r.error ?? "Nie udało się wysłać" };
    result.ok = result.ok && r.ok;
  } else {
    result.telegram = { ok: false, message: "Brak TESLA_TELEGRAM_TOKEN lub TESLA_TELEGRAM_CHAT_ID. Ustaw zmienne w Coolify → Environment." };
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
