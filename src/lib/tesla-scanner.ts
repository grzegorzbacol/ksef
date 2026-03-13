/**
 * Tesla Inventory Scanner – logika współdzielona (CLI + API)
 */

import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SEEN_FILE = path.join(DATA_DIR, "tesla_seen.json");
const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "tesla.log");

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/html, */*",
  "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
  Referer: "https://www.tesla.com/pl_PL/inventory/new/my",
  Origin: "https://www.tesla.com",
  "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
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

const CORS_PROXIES = [
  { url: (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, unwrap: (t: string) => { try { const p = JSON.parse(t) as { contents?: string }; return p.contents ?? t; } catch { return t; } } },
  { url: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`, unwrap: (t: string) => t },
];

async function fetchWithProxy(apiUrl: string, proxyUrl: string): Promise<string> {
  const { ProxyAgent, fetch: ufetch } = await import("undici");
  const agent = new ProxyAgent(proxyUrl);
  const res = await ufetch(apiUrl, {
    headers: DEFAULT_HEADERS,
    dispatcher: agent,
  } as Record<string, unknown>);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchViaCorsProxy(apiUrl: string, proxyIndex: number): Promise<string> {
  const proxy = CORS_PROXIES[proxyIndex];
  const res = await fetch(proxy.url(apiUrl), {
    headers: { "User-Agent": DEFAULT_HEADERS["User-Agent"] ?? "" },
  });
  if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
  const text = await res.text();
  return proxy.unwrap(text);
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
  const proxyEnv = process.env.TESLA_PROXY_URL?.trim();

  if (proxyEnv) {
    try {
      log("Używam TESLA_PROXY_URL...");
      const text = await fetchWithProxy(apiUrl, proxyEnv);
      const parsed = JSON.parse(text);
      if (parsed.results !== undefined) return text;
    } catch (e) {
      log(`Proxy nie powiódł się: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  let res = await fetch(apiUrl, { headers: DEFAULT_HEADERS });
  if (res.ok) return res.text();

  if (res.status === 403 || res.status === 429) {
    log("Bezpośredni fetch zablokowany, próba przez CORS proxy...");
    for (let i = 0; i < CORS_PROXIES.length; i++) {
      try {
        const text = await fetchViaCorsProxy(apiUrl, i);
        const parsed = JSON.parse(text);
        if (parsed.results !== undefined) {
          log(`CORS proxy ${i + 1} OK`);
          return text;
        }
      } catch (e) {
        log(`CORS proxy ${i + 1} nie powiódł się: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  throw new Error(`HTTP ${res.status}`);
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
