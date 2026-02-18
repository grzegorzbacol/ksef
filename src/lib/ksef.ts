/**
 * Moduł integracji z KSEF (Krajowy System e-Faktur).
 * Źródło konfiguracji: ustawienia z bazy (Ustawienia → KSEF) lub zmienne env.
 * Dokumentacja: https://ksef.mf.gov.pl, API 2.0
 */

import { getKsefSettings, setSetting } from "./settings";

const DEFAULT_API_URL = "https://api.ksef.mf.gov.pl";

/** Sprawdza, czy token nadaje się do nagłówka HTTP (tylko ASCII). Zwraca token, jeśli OK, lub null przy znakach spoza ASCII. */
function tokenSafeForHeader(token: string): string | null {
  if (!token) return null;
  if (/[^\x00-\x7F]/.test(token)) return null;
  return token;
}

export type KsefSendResult = { success: boolean; ksefId?: string; error?: string };

export type KsefInvoiceRaw = {
  number?: string;
  referenceNumber?: string;
  issueDate?: string;
  saleDate?: string;
  sellerName?: string;
  sellerNip?: string;
  buyerName?: string;
  buyerNip?: string;
  netAmount?: number;
  vatAmount?: number;
  grossAmount?: number;
  currency?: string;
  /** Struktura FA – pola z wiersza (np. P_1 = numer) */
  P_1?: string;
  P_2_1?: string;
  P_13_1?: string;
  P_14_1?: string;
  P_15_1?: string;
  P_16_1?: string;
  [key: string]: unknown;
};

export type KsefInvoiceNormalized = {
  number: string;
  /** Numer referencyjny KSEF – używany do pobrania PDF (getInvoicePdfFromKsef). */
  referenceNumber?: string;
  issueDate: string;
  saleDate?: string;
  sellerName: string;
  sellerNip: string;
  buyerName: string;
  buyerNip: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  currency: string;
};

export type KsefFetchResult = {
  success: boolean;
  invoices?: KsefInvoiceNormalized[];
  error?: string;
  count?: number;
};

/** Mapowanie odpowiedzi KSEF (różne warianty FA/JSON) na wspólny format */
function normalizeKsefInvoice(raw: KsefInvoiceRaw): KsefInvoiceNormalized | null {
  const number =
    raw.number ??
    raw.referenceNumber ??
    raw.P_1 ??
    (raw as Record<string, unknown>)["Numer"] ??
    "";
  if (!number || String(number).trim() === "") return null;

  const issueDate =
    raw.issueDate ??
    raw.P_2_1 ??
    (raw as Record<string, unknown>)["DataWystawienia"] ??
    new Date().toISOString().slice(0, 10);

  const sellerNip = String(raw.sellerNip ?? raw.P_13_1 ?? "").trim();
  const sellerName = String(raw.sellerName ?? raw.P_14_1 ?? "").trim();
  const buyerNip = String(raw.buyerNip ?? raw.P_15_1 ?? "").trim();
  const buyerName = String(raw.buyerName ?? raw.P_16_1 ?? "").trim();

  const netAmount = Number(raw.netAmount) || 0;
  const vatAmount = Number(raw.vatAmount) || 0;
  const grossAmount = Number(raw.grossAmount) || netAmount + vatAmount;
  const currency = String(raw.currency ?? "PLN").trim() || "PLN";

  const refNum = raw.referenceNumber ? String(raw.referenceNumber).trim() : undefined;
  return {
    number: String(number).trim(),
    referenceNumber: refNum || undefined,
    issueDate: String(issueDate).slice(0, 10),
    saleDate: raw.saleDate ? String(raw.saleDate).slice(0, 10) : undefined,
    sellerName: sellerName || "—",
    sellerNip: sellerNip || "—",
    buyerName: buyerName || "—",
    buyerNip: buyerNip || "—",
    netAmount,
    vatAmount,
    grossAmount,
    currency,
  };
}

function parseKsefResponse(body: unknown): KsefInvoiceRaw[] {
  if (Array.isArray(body)) return body as KsefInvoiceRaw[];
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.invoices)) return o.invoices as KsefInvoiceRaw[];
    if (Array.isArray(o.items)) return o.items as KsefInvoiceRaw[];
    if (Array.isArray(o.invoiceMetadataList)) return o.invoiceMetadataList as KsefInvoiceRaw[];
    if (Array.isArray(o.results)) return o.results as KsefInvoiceRaw[];
    if (Array.isArray(o.records)) return o.records as KsefInvoiceRaw[];
    if (Array.isArray(o.elements)) return o.elements as KsefInvoiceRaw[];
    if (Array.isArray(o.lista)) return o.lista as KsefInvoiceRaw[];
    if (Array.isArray(o.data)) return o.data as KsefInvoiceRaw[];
    if (Array.isArray(o.wynik)) return o.wynik as KsefInvoiceRaw[];
  }
  return [];
}

/** Mapuje metadane faktury z odpowiedzi KSEF 2.0 (seller/buyer jako obiekty) na KsefInvoiceRaw. */
function mapKsef2MetadataToRaw(item: Record<string, unknown>): KsefInvoiceRaw {
  const seller = item.seller as Record<string, unknown> | undefined;
  const buyer = item.buyer as Record<string, unknown> | undefined;
  const buyerId = buyer?.identifier as Record<string, unknown> | undefined;
  const str = (v: unknown) => (v != null ? String(v) : undefined);
  const num = (v: unknown) => (typeof v === "number" ? v : v != null ? Number(v) : undefined);
  return {
    number: str(item.invoiceNumber ?? item.ksefNumber),
    referenceNumber: str(item.ksefNumber),
    issueDate: str(item.issueDate),
    saleDate: str(item.invoicingDate),
    sellerNip: str(seller?.nip ?? seller?.["nip"]),
    sellerName: str(seller?.name ?? seller?.["name"]),
    buyerNip: str(buyerId?.value ?? buyer?.["nip"]),
    buyerName: str(buyer?.name ?? buyer?.["name"]),
    netAmount: num(item.netAmount),
    vatAmount: num(item.vatAmount),
    grossAmount: num(item.grossAmount),
    currency: str(item.currency),
  };
}

function isKsef2Metadata(item: Record<string, unknown>): boolean {
  return typeof item.seller === "object" || typeof item.buyer === "object";
}

/** Sprawdza, czy KSEF jest skonfigurowany (ustawienia lub env: URL + token). */
export async function isKsefConfigured(): Promise<boolean> {
  const envOk = !!process.env.KSEF_API_URL?.trim() && !!process.env.KSEF_TOKEN?.trim();
  if (envOk) return true;
  const s = await getKsefSettings();
  return !!s.apiUrl && !!s.token;
}

/**
 * Odświeża token dostępu KSEF za pomocą refresh tokena (KSEF 2.0: POST /v2/auth/token/refresh).
 * Zapisuje nowy access token (i ewentualnie nowy refresh token) w ustawieniach.
 * Zwraca nowy access token lub null przy braku refresh tokena / błędzie.
 */
export async function refreshKsefAccessToken(): Promise<string | null> {
  const s = await getKsefSettings();
  const apiUrl = (s.apiUrl || process.env.KSEF_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  const refreshToken = (s.refreshToken || "").trim();
  if (!refreshToken) return null;
  const refreshForHeader = tokenSafeForHeader(refreshToken);
  if (!refreshForHeader) return null;
  try {
    const url = `${apiUrl}/v2/auth/token/refresh`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshForHeader}`,
      },
    });
    if (!res.ok) return null;
    const text = await res.text();
    const data = JSON.parse(text) as {
      accessToken?: { token?: string; validUntil?: string };
      refreshToken?: { token?: string; validUntil?: string };
    };
    const newAccess = data.accessToken?.token;
    const newRefresh = data.refreshToken?.token;
    if (!newAccess) return null;
    await setSetting("ksef_token", newAccess);
    if (newRefresh) await setSetting("ksef_refresh_token", newRefresh);
    return newAccess;
  } catch {
    return null;
  }
}

/**
 * Pobiera faktury z KSEF z podanego zakresu dat.
 * Endpoint zgodny z API KSeF 2.0 (zapytanie o faktury po zakresie dat).
 */
export async function fetchInvoicesFromKsef(
  dateFrom: string,
  dateTo: string
): Promise<KsefFetchResult> {
  const s = await getKsefSettings();
  const apiUrl = (s.apiUrl || process.env.KSEF_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  let token = (s.token || (process.env.KSEF_TOKEN ?? "")).trim();
  const queryPath = s.queryPath || process.env.KSEF_QUERY_INVOICES_PATH || "/v2/invoices/query/metadata";

  if (!token) {
    return {
      success: false,
      error: "Brak tokenu KSEF. Uzupełnij w Ustawieniach → Integracja KSEF.",
    };
  }

  let tokenForHeader = tokenSafeForHeader(token);
  if (!tokenForHeader) {
    return {
      success: false,
      error: "Token KSEF zawiera niedozwolone znaki (np. polskie litery przy wklejaniu). Użyj tokenu tylko ze znakami ASCII – skopiuj ponownie z portalu KSEF.",
    };
  }

  const from = dateFrom.slice(0, 10);
  const to = dateTo.slice(0, 10);
  const queryParams = new URLSearchParams({
    sortOrder: "Asc",
    pageOffset: "0",
    pageSize: "100",
  });
  const url = `${apiUrl}${queryPath}?${queryParams}`;

  const runWithToken = async (authToken: string): Promise<KsefInvoiceNormalized[]> => {
    const forHeader = tokenSafeForHeader(authToken);
    if (!forHeader) throw new Error("Token zawiera niedozwolone znaki.");

    const fetchForSubject = async (subjectType: "Subject1" | "Subject2"): Promise<KsefInvoiceRaw[]> => {
      const body = {
        subjectType,
        dateRange: {
          dateType: "Issue",
          from: `${from}T00:00:00`,
          to: `${to}T23:59:59`,
        },
      };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${forHeader}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        let errMsg = `KSEF API ${res.status}: ${res.statusText}`;
        try {
          const json = JSON.parse(text);
          errMsg = json.message ?? json.error ?? text?.slice(0, 200) ?? errMsg;
        } catch {
          if (text) errMsg += ` – ${text.slice(0, 150)}`;
        }
        if (res.status === 401) {
          errMsg =
            "KSEF odrzucił token (401). Token mógł wygasnąć – w KSEF 2.0 tokeny dostępu są krótkoterminowe. Uzyskaj nowy token w portalu KSEF i wklej go w Ustawieniach → Integracja KSEF.";
        }
        throw new Error(errMsg);
      }
      const data = await res.json().catch(() => ({}));
      let rawList = parseKsefResponse(data);
      rawList = rawList.map((r) => {
        const o = r as Record<string, unknown>;
        return isKsef2Metadata(o) ? mapKsef2MetadataToRaw(o) : (r as KsefInvoiceRaw);
      });
      return rawList;
    };

    const [list1, list2] = await Promise.all([
      fetchForSubject("Subject1"),
      fetchForSubject("Subject2"),
    ]);
    const seen = new Set<string>();
    const invoices: KsefInvoiceNormalized[] = [];
    for (const raw of [...list1, ...list2]) {
      const normalized = normalizeKsefInvoice(raw as KsefInvoiceRaw);
      if (!normalized) continue;
      const key = `${normalized.number}|${normalized.issueDate}|${normalized.sellerNip}|${normalized.buyerNip}`;
      if (seen.has(key)) continue;
      seen.add(key);
      invoices.push(normalized);
    }
    return invoices;
  };

  try {
    let invoices = await runWithToken(token);
    return { success: true, invoices, count: invoices.length };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (errMsg.includes("401") && (await refreshKsefAccessToken())) {
      const s2 = await getKsefSettings();
      const newToken = (s2.token || "").trim();
      if (newToken) {
        try {
          const invoices = await runWithToken(newToken);
          return { success: true, invoices, count: invoices.length };
        } catch {
          // fall through to original error
        }
      }
    }
    return {
      success: false,
      error: `Połączenie z KSEF nie powiodło się: ${errMsg}`,
    };
  }
}

/**
 * Wysyła fakturę do KSEF (struktura FA w XML/JSON).
 * W produkcji: pełna struktura FA(2)/FA(3) i certyfikat.
 */
export async function sendInvoiceToKsef(invoice: unknown): Promise<KsefSendResult> {
  const s = await getKsefSettings();
  const apiUrl = (s.apiUrl || process.env.KSEF_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  let token = (s.token || (process.env.KSEF_TOKEN ?? "")).trim();
  const sendPath = s.sendPath || process.env.KSEF_SEND_INVOICE_PATH || "/api/online/Invoice/Send";

  if (!token) {
    return {
      success: false,
      error: "Brak tokenu KSEF. Uzupełnij w Ustawieniach → Integracja KSEF.",
    };
  }

  const tokenForHeader = tokenSafeForHeader(token);
  if (!tokenForHeader) {
    return {
      success: false,
      error: "Token KSEF zawiera niedozwolone znaki (np. polskie litery przy wklejaniu). Użyj tokenu tylko ze znakami ASCII – skopiuj ponownie z portalu KSEF.",
    };
  }

  const doSend = async (authToken: string): Promise<KsefSendResult> => {
    const forHeader = tokenSafeForHeader(authToken);
    if (!forHeader) return { success: false, error: "Token zawiera niedozwolone znaki." };
    const url = `${apiUrl}${sendPath}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${forHeader}`,
      },
      body: JSON.stringify(invoice),
    });
    if (!res.ok) {
      const text = await res.text();
      let errMsg = `KSEF API ${res.status}`;
      try {
        const json = JSON.parse(text);
        errMsg = json.message ?? json.error ?? errMsg;
      } catch {
        if (text) errMsg += ` – ${text.slice(0, 120)}`;
      }
      return { success: false, error: errMsg };
    }
    const data = await res.json().catch(() => ({}));
    const ksefId =
      (data as Record<string, unknown>)?.referenceNumber ??
      (data as Record<string, unknown>)?.ksefId ??
      (data as Record<string, unknown>)?.id ??
      `KSEF-${Date.now()}`;
    return { success: true, ksefId: String(ksefId) };
  };

  try {
    let result = await doSend(token);
    if (!result.success && result.error?.includes("401") && (await refreshKsefAccessToken())) {
      const s2 = await getKsefSettings();
      const newToken = (s2.token || "").trim();
      if (newToken) result = await doSend(newToken);
    }
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Wysyłka do KSEF: ${message}` };
  }
}

/** Domyślna ścieżka do pobrania pliku PDF faktury po numerze KSEF (referenceNumber). */
const DEFAULT_INVOICE_PDF_PATH = "/v2/invoices/{referenceNumber}/file";

export type KsefInvoicePdfResult =
  | { success: true; pdf: ArrayBuffer }
  | { success: false; error: string };

/**
 * Pobiera PDF faktury bezpośrednio z KSEF po numerze identyfikacyjnym (ksefId / referenceNumber).
 * Ścieżka API jest konfigurowalna przez env KSEF_INVOICE_PDF_PATH (np. /v2/invoices/{referenceNumber}/file).
 * W treści ścieżki {referenceNumber} zostanie zastąpione przez ksefId.
 */
export async function getInvoicePdfFromKsef(ksefId: string): Promise<KsefInvoicePdfResult> {
  const s = await getKsefSettings();
  const apiUrl = (s.apiUrl || process.env.KSEF_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  let token = (s.token || (process.env.KSEF_TOKEN ?? "")).trim();
  const pathTemplate =
    s.invoicePdfPath || process.env.KSEF_INVOICE_PDF_PATH?.trim() || DEFAULT_INVOICE_PDF_PATH;
  const path = pathTemplate.replace(/\{referenceNumber\}/g, encodeURIComponent(ksefId));

  if (!token) {
    return { success: false, error: "Brak tokenu KSEF." };
  }

  const tokenForHeader = tokenSafeForHeader(token);
  if (!tokenForHeader) {
    return { success: false, error: "Token KSEF zawiera niedozwolone znaki." };
  }

  const doFetch = async (authToken: string): Promise<KsefInvoicePdfResult> => {
    const forHeader = tokenSafeForHeader(authToken);
    if (!forHeader) return { success: false, error: "Token zawiera niedozwolone znaki." };
    const url = `${apiUrl}${path}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/pdf",
        Authorization: `Bearer ${forHeader}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      let errMsg = `KSEF API ${res.status}`;
      try {
        const json = JSON.parse(text);
        errMsg = (json.message ?? json.error ?? errMsg) as string;
      } catch {
        if (text) errMsg += ` – ${text.slice(0, 120)}`;
      }
      return { success: false, error: errMsg };
    }
    const contentType = res.headers.get("Content-Type") || "";
    if (!contentType.includes("pdf")) {
      return {
        success: false,
        error: "KSEF nie zwrócił PDF (Content-Type: " + contentType + ").",
      };
    }

    const pdf = await res.arrayBuffer();
    if (!pdf.byteLength) {
      return { success: false, error: "Pusta odpowiedź PDF z KSEF." };
    }

    return { success: true, pdf };
  };

  try {
    let result = await doFetch(token);
    if (!result.success && result.error?.includes("401") && (await refreshKsefAccessToken())) {
      const s2 = await getKsefSettings();
      const newToken = (s2.token || "").trim();
      if (newToken) result = await doFetch(newToken);
    }
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Pobieranie PDF z KSEF: ${message}` };
  }
}
