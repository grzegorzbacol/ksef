/**
 * Konwersja faktury w formacie FA (XML z KSEF) na PDF.
 * Pełne dane, polskie znaki (czcionka Unicode), czytelna grafika.
 */

import { XMLParser } from "fast-xml-parser";
import { jsPDF } from "jspdf";

export type FaInvoiceData = {
  number: string;
  issueDate: string;
  saleDate?: string;
  dateFrom?: string;
  dateTo?: string;
  sellerName: string;
  sellerNip: string;
  sellerAddress?: string;
  sellerCorrespondenceAddress?: string;
  sellerContact?: string;
  buyerName: string;
  buyerNip: string;
  buyerAddress?: string;
  buyerCorrespondenceAddress?: string;
  buyerContact?: string;
  customerNumber?: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  currency: string;
  items: {
    name: string;
    quantity: string;
    unit: string;
    unitPriceNet: number;
    discount: number;
    taxRate: string;
    net: number;
    vat: number;
  }[];
  taxSummary?: { rate: string; net: number; vat: number; gross: number }[];
  paymentInfo?: string;
  paymentForm?: string;
  paymentDueDate?: string;
  bankAccount?: string;
  swift?: string;
  bankName?: string;
  contractNumber?: string;
  krs?: string;
  regon?: string;
  ksefNumber?: string;
  ksefVerificationUrl?: string;
  footerNote?: string;
  additionalInfo?: { lineNo?: string; type?: string; content: string }[];
};

function stripNs(tag: string): string {
  const i = tag.indexOf(":");
  return i > 0 ? tag.slice(i + 1) : tag;
}

function getFirstText(obj: unknown): string {
  if (obj == null) return "";
  if (typeof obj === "string") return String(obj).trim();
  if (typeof obj === "number") return String(obj);
  if (Array.isArray(obj)) return getFirstText(obj[0]);
  if (typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    if (o["#text"] != null) return String(o["#text"]).trim();
  }
  return "";
}

function getFirstNum(obj: unknown): number {
  const s = getFirstText(obj);
  const n = parseFloat(s.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function collect(
  node: unknown,
  outText: Record<string, string>,
  outNum: Record<string, number>,
  textKeys: string[],
  numKeys: string[]
): void {
  if (node == null || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    const clean = stripNs(k);
    if (textKeys.includes(clean) && outText[clean] === undefined) {
      outText[clean] = typeof v === "string" ? v.trim() : getFirstText(v);
    }
    if (numKeys.includes(clean) && outNum[clean] === undefined) {
      outNum[clean] = getFirstNum(v);
    }
    if (v && typeof v === "object" && !Array.isArray(v)) collect(v, outText, outNum, textKeys, numKeys);
    if (Array.isArray(v)) for (const item of v) collect(item, outText, outNum, textKeys, numKeys);
  }
}

function getTextFromObj(obj: Record<string, unknown>, key: string): string {
  const v = obj[key] ?? obj[stripNs(key)];
  return getFirstText(v);
}
function getNumFromObj(obj: Record<string, unknown>, key: string): number {
  const v = obj[key] ?? obj[stripNs(key)];
  return getFirstNum(v);
}

function formatAddress(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  const kodKraju = getTextFromObj(obj, "KodKraju");
  const adresL1 = getTextFromObj(obj, "AdresL1") || getTextFromObj(obj, "NazwaUlicy");
  const nrDomu = getTextFromObj(obj, "NrDomu");
  const nrLokalu = getTextFromObj(obj, "NrLokalu");
  const kodPocztowy = getTextFromObj(obj, "KodPocztowy");
  const miejscowosc = getTextFromObj(obj, "Miejscowosc") || getTextFromObj(obj, "NazwaMiejscowosci");
  if (adresL1 || nrDomu) parts.push([adresL1, nrDomu, nrLokalu].filter(Boolean).join(" "));
  if (kodPocztowy || miejscowosc) parts.push([kodPocztowy, miejscowosc].filter(Boolean).join(" "));
  if (kodKraju) parts.push(kodKraju);
  return parts.join("\n");
}

function getNested(obj: unknown, key: string): unknown {
  if (obj == null || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  const v = o[key] ?? o[stripNs(key)];
  return v;
}

function collectPartyData(parsed: unknown): {
  sellerAddress?: string;
  sellerContact?: string;
  buyerAddress?: string;
  buyerContact?: string;
} {
  const out: { sellerAddress?: string; sellerContact?: string; buyerAddress?: string; buyerContact?: string } = {};
  function walk(n: unknown, depth: number, path: string[]): void {
    if (n == null || typeof n !== "object" || depth > 15) return;
    const o = n as Record<string, unknown>;
    for (const [tag, val] of Object.entries(o)) {
      const clean = stripNs(tag);
      if (clean === "Podmiot1" && !out.sellerAddress) {
        const adres = getNested(val, "Adres");
        if (adres && typeof adres === "object") out.sellerAddress = formatAddress(adres as Record<string, unknown>);
        const kontakt = getFirstText(getNested(val, "DaneKontaktowe") ?? getNested(val, "Email") ?? getNested(val, "Telefon"));
        if (kontakt) out.sellerContact = kontakt;
      }
      if (clean === "Podmiot2" && !out.buyerAddress) {
        const adres = getNested(val, "Adres");
        if (adres && typeof adres === "object") out.buyerAddress = formatAddress(adres as Record<string, unknown>);
        const kontakt = getFirstText(getNested(val, "DaneKontaktowe") ?? getNested(val, "Email") ?? getNested(val, "Telefon"));
        if (kontakt) out.buyerContact = kontakt;
      }
      if (val && typeof val === "object") {
        if (Array.isArray(val)) val.forEach((item) => walk(item, depth + 1, [...path, tag]));
        else walk(val, depth + 1, [...path, tag]);
      }
    }
  }
  walk(parsed, 0, []);
  return out;
}

function collectLines(node: unknown): FaInvoiceData["items"] {
  const items: FaInvoiceData["items"] = [];
  if (node == null || typeof node !== "object") return items;

  function walk(n: unknown): void {
    if (n == null || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    for (const [tag, val] of Object.entries(o)) {
      const clean = stripNs(tag);
      if (clean === "FaWiersz" || clean === "Wiersz") {
        const rows = Array.isArray(val) ? val : val ? [val] : [];
        for (const row of rows) {
          if (row && typeof row === "object") {
            const r = row as Record<string, unknown>;
            items.push({
              name: getTextFromObj(r, "P_7") || getTextFromObj(r, "P_7_1") || getTextFromObj(r, "Nazwa") || "—",
              quantity: getTextFromObj(r, "P_8") || getTextFromObj(r, "Ilosc") || "1",
              unit: getTextFromObj(r, "P_9") || getTextFromObj(r, "Jednostka") || "szt.",
              unitPriceNet: getNumFromObj(r, "P_10") || getNumFromObj(r, "CenaJednostkowa"),
              discount: getNumFromObj(r, "Rabat") || 0,
              taxRate: getTextFromObj(r, "P_12_2") || getTextFromObj(r, "StawkaPodatku") || "23%",
              net: getNumFromObj(r, "P_11") || getNumFromObj(r, "P_11_1") || getNumFromObj(r, "KwotaNetto"),
              vat: getNumFromObj(r, "P_12") || getNumFromObj(r, "P_12_1") || getNumFromObj(r, "KwotaVAT"),
            });
          }
        }
        continue;
      }
      if (val && typeof val === "object") {
        if (Array.isArray(val)) val.forEach(walk);
        else walk(val);
      }
    }
  }
  walk(node);
  return items;
}

const TEXT_KEYS = [
  "P_1", "P_2_1", "P_3_1", "P_4_1", "P_4_2",
  "P_13_1", "P_14_1", "P_15_1", "P_16_1",
  "Numer", "DataWystawienia", "DataSprzedazy", "Waluta",
  "NIP", "Nazwa", "KodKraju", "AdresL1", "NazwaUlicy", "NrDomu", "NrLokalu", "KodPocztowy", "Miejscowosc", "NazwaMiejscowosci",
  "Email", "Telefon", "NumerKlienta", "NumerUmowy",
  "FormaPlatnosci", "TerminPlatnosci", "NumerRachunku", "SWIFT", "NazwaBanku",
  "KRS", "REGON", "NumerKSeF", "LinkWeryfikacyjny", "StopkaFaktury",
];
const NUM_KEYS = ["P_13_2", "P_14_2", "P_15_2", "KwotaNetto", "KwotaVAT", "KwotaBrutto"];

export function parseFaXmlToInvoiceData(xmlString: string): FaInvoiceData | null {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
    transformTagName: (name) => stripNs(name),
  });
  let parsed: unknown;
  try {
    parsed = parser.parse(xmlString);
  } catch {
    return null;
  }
  const text: Record<string, string> = {};
  const num: Record<string, number> = {};
  collect(parsed, text, num, TEXT_KEYS, NUM_KEYS);

  const number = text.P_1 || text.Numer || "";
  const issueDate = text.P_2_1 || text.DataWystawienia || new Date().toISOString().slice(0, 10);
  const saleDate = text.P_3_1 || text.DataSprzedazy || undefined;
  const dateFrom = text.P_4_1 || undefined;
  const dateTo = text.P_4_2 || undefined;
  const sellerNip = text.P_13_1 || text.NIP || "—";
  const sellerName = text.P_14_1 || text.Nazwa || "—";
  const buyerNip = text.P_15_1 || "—";
  const buyerName = text.P_16_1 || "—";
  const netAmount = num.P_13_2 || num.KwotaNetto || 0;
  const vatAmount = num.P_14_2 || num.KwotaVAT || 0;
  const grossAmount = num.P_15_2 || num.KwotaBrutto || netAmount + vatAmount;
  const currency = text.Waluta || "PLN";

  const items = collectLines(parsed);
  const party = collectPartyData(parsed);
  if (!number && !sellerNip && !buyerNip) return null;

  const data: FaInvoiceData = {
    number: number || "—",
    issueDate: issueDate.slice(0, 10),
    saleDate: saleDate?.slice(0, 10),
    dateFrom: dateFrom?.slice(0, 10),
    dateTo: dateTo?.slice(0, 10),
    sellerName: sellerName || "—",
    sellerNip: sellerNip || "—",
    buyerName: buyerName || "—",
    buyerNip: buyerNip || "—",
    netAmount,
    vatAmount,
    grossAmount,
    currency,
    items: items.length ? items : [{ name: "—", quantity: "1", unit: "szt.", unitPriceNet: netAmount, discount: 0, taxRate: "23%", net: netAmount, vat: vatAmount }],
  };

  if (party.sellerAddress) data.sellerAddress = party.sellerAddress;
  if (party.sellerContact) data.sellerContact = party.sellerContact;
  if (party.buyerAddress) data.buyerAddress = party.buyerAddress;
  if (party.buyerContact) data.buyerContact = party.buyerContact;
  if (text.NumerKlienta) data.customerNumber = text.NumerKlienta;
  if (!data.buyerContact && (text.Email || text.Telefon)) data.buyerContact = [text.Email, text.Telefon].filter(Boolean).join(", ");
  if (text.FormaPlatnosci) data.paymentForm = text.FormaPlatnosci;
  if (text.TerminPlatnosci) data.paymentDueDate = text.TerminPlatnosci;
  if (text.NumerRachunku) data.bankAccount = text.NumerRachunku;
  if (text.SWIFT) data.swift = text.SWIFT;
  if (text.NazwaBanku) data.bankName = text.NazwaBanku;
  if (text.NumerUmowy) data.contractNumber = text.NumerUmowy;
  if (text.KRS) data.krs = text.KRS;
  if (text.REGON) data.regon = text.REGON;
  if (text.NumerKSeF) data.ksefNumber = text.NumerKSeF;
  if (text.LinkWeryfikacyjny) data.ksefVerificationUrl = text.LinkWeryfikacyjny;
  if (text.StopkaFaktury) data.footerNote = text.StopkaFaktury;

  return data;
}

const FONT_URL = "https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf";
let cachedFontBase64: string | null = null;

async function getUnicodeFontBase64(): Promise<string> {
  if (cachedFontBase64) return cachedFontBase64;
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error("Nie udało się pobrać czcionki.");
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  cachedFontBase64 = typeof Buffer !== "undefined" ? Buffer.from(buf).toString("base64") : btoa(binary);
  return cachedFontBase64;
}

function formatDatePl(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

function splitLines(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, fontSize: number): number {
  const font = doc.getFont();
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.setFontSize(fontSize);
  for (const line of lines) {
    doc.text(line, x, y);
    y += fontSize * 0.4;
  }
  return y;
}

export async function generatePdfFromFaData(data: FaInvoiceData): Promise<ArrayBuffer> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 18;
  const pageW = 210;
  const col1 = margin;
  const col2 = 105;
  let y = margin;
  const lineH = 5;
  const sectionGap = 6;
  const labelSize = 8;
  const valueSize = 9;
  const titleSize = 14;

  const base64 = await getUnicodeFontBase64();
  doc.addFileToVFS("DejaVuSans.ttf", base64);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.setFont("DejaVu", "normal");

  function label(t: string): void {
    doc.setFontSize(labelSize);
    doc.setFont("DejaVu", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(t, col1, y);
    y += lineH * 0.9;
  }
  function value(t: string, opts?: { col?: number; wrap?: number }): void {
    doc.setFontSize(valueSize);
    doc.setFont("DejaVu", "normal");
    doc.setTextColor(0, 0, 0);
    const x = opts?.col ?? col1;
    const wrap = opts?.wrap ?? (pageW - margin - x);
    if (opts?.wrap) {
      y = splitLines(doc, t, x, y, wrap, valueSize);
    } else {
      doc.text(t, x, y);
      y += lineH;
    }
  }
  function sectionTitle(t: string): void {
    y += sectionGap;
    doc.setFontSize(10);
    doc.setFont("DejaVu", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(t, col1, y);
    y += lineH + 2;
  }

  doc.setFontSize(titleSize);
  doc.setFont("DejaVu", "normal");
  doc.text("Faktura " + data.number, col1, y);
  y += lineH + 6;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(col1, y, pageW - margin, y);
  y += sectionGap;

  sectionTitle("Sprzedawca");
  label("Nazwa:");
  value(data.sellerName, { wrap: 85 });
  label("NIP:");
  value(data.sellerNip);
  if (data.sellerAddress) {
    label("Adres:");
    value(data.sellerAddress, { wrap: 85 });
  }
  if (data.sellerCorrespondenceAddress) {
    label("Adres do korespondencji:");
    value(data.sellerCorrespondenceAddress, { wrap: 85 });
  }
  if (data.sellerContact) {
    label("Dane kontaktowe:");
    value(data.sellerContact, { wrap: 85 });
  }

  y += 2;
  sectionTitle("Nabywca");
  label("NIP:");
  value(data.buyerNip);
  label("Nazwa:");
  value(data.buyerName, { wrap: 85 });
  if (data.buyerAddress) {
    label("Adres:");
    value(data.buyerAddress, { wrap: 85 });
  }
  if (data.buyerCorrespondenceAddress) {
    label("Adres do korespondencji:");
    value(data.buyerCorrespondenceAddress, { wrap: 85 });
  }
  if (data.buyerContact) {
    label("Dane kontaktowe:");
    value(data.buyerContact, { wrap: 85 });
  }
  if (data.customerNumber) {
    label("Numer klienta:");
    value(data.customerNumber);
  }

  y += 2;
  sectionTitle("Szczegóły");
  label("Data wystawienia:");
  value(data.issueDate ? formatDatePl(data.issueDate) : "—");
  if (data.saleDate) {
    label("Data sprzedaży:");
    value(formatDatePl(data.saleDate));
  }
  if (data.dateFrom || data.dateTo) {
    label("Data dostawy:");
    value([data.dateFrom ? formatDatePl(data.dateFrom) : "", data.dateTo ? formatDatePl(data.dateTo) : ""].filter(Boolean).join(" – ") || "—");
  }

  y += 2;
  sectionTitle("Pozycje");
  value("Faktura wystawiona w cenach netto w walucie " + data.currency + ".", { wrap: 170 });
  y += 3;

  const tableCols = [12, 72, 18, 14, 12, 14, 22, 18];
  const headers = ["Lp.", "Nazwa towaru lub usługi", "Cena jedn. netto", "Ilość", "Miara", "Stawka", "Wartość netto", "Wartość VAT"];
  doc.setFontSize(8);
  doc.setFont("DejaVu", "normal");
  let x = col1;
  headers.forEach((h, i) => {
    doc.text(h, x, y);
    x += tableCols[i];
  });
  y += lineH + 1;
  doc.setFont("DejaVu", "normal");

  data.items.forEach((it, idx) => {
    if (y > 265) {
      doc.addPage();
      y = margin;
      doc.setFont("DejaVu", "normal");
      doc.setFontSize(valueSize);
    }
    x = col1;
    doc.text(String(idx + 1), x, y);
    x += tableCols[0];
    const nameLines = doc.splitTextToSize(it.name || "—", tableCols[1] - 2);
    doc.text(nameLines[0], x, y);
    if (nameLines.length > 1) doc.text(nameLines.slice(1).join(" "), x, y + 3.5);
    x += tableCols[1];
    doc.text(it.unitPriceNet.toFixed(2), x, y);
    x += tableCols[2];
    doc.text(it.quantity, x, y);
    x += tableCols[3];
    doc.text(it.unit, x, y);
    x += tableCols[4];
    doc.text(it.taxRate, x, y);
    x += tableCols[5];
    doc.text(it.net.toFixed(2), x, y);
    x += tableCols[6];
    doc.text(it.vat.toFixed(2), x, y);
    y += nameLines.length > 1 ? lineH + 4 : lineH + 1;
  });

  y += 4;
  doc.setFont("DejaVu", "normal");
  doc.setFontSize(valueSize);
  doc.text("Kwota należności ogółem: " + data.grossAmount.toFixed(2) + " " + data.currency, col1, y);
  y += lineH + 4;

  if (data.taxSummary && data.taxSummary.length > 0) {
    sectionTitle("Podsumowanie stawek podatku");
    const sumCols = [25, 35, 35, 35];
    doc.setFont("DejaVu", "normal");
    doc.setFontSize(8);
    doc.text("Stawka", col1, y);
    doc.text("Kwota netto", col1 + sumCols[0], y);
    doc.text("Kwota podatku", col1 + sumCols[0] + sumCols[1], y);
    doc.text("Kwota brutto", col1 + sumCols[0] + sumCols[1] + sumCols[2], y);
    y += lineH;
    doc.setFont("DejaVu", "normal");
    data.taxSummary.forEach((row) => {
      doc.text(row.rate, col1, y);
      doc.text(row.net.toFixed(2), col1 + sumCols[0], y);
      doc.text(row.vat.toFixed(2), col1 + sumCols[0] + sumCols[1], y);
      doc.text(row.gross.toFixed(2), col1 + sumCols[0] + sumCols[1] + sumCols[2], y);
      y += lineH;
    });
    y += 2;
  }

  if (data.paymentForm || data.paymentDueDate || data.bankAccount) {
    sectionTitle("Płatność");
    if (data.paymentInfo) {
      label("Informacja o płatności:");
      value(data.paymentInfo);
    }
    if (data.paymentForm) {
      label("Forma płatności:");
      value(data.paymentForm);
    }
    if (data.paymentDueDate) {
      label("Termin płatności:");
      value(formatDatePl(data.paymentDueDate));
    }
    if (data.bankAccount) {
      label("Numer rachunku bankowego:");
      value(data.bankAccount);
    }
    if (data.swift) {
      label("Kod SWIFT:");
      value(data.swift);
    }
    if (data.bankName) {
      label("Nazwa banku:");
      value(data.bankName);
    }
  }

  if (data.contractNumber) {
    sectionTitle("Warunki transakcji");
    label("Numer umowy:");
    value(data.contractNumber);
  }

  if (data.krs || data.regon) {
    sectionTitle("Rejestry");
    if (data.sellerName) value("Pełna nazwa: " + data.sellerName);
    if (data.krs) value("KRS: " + data.krs);
    if (data.regon) value("REGON: " + data.regon);
  }

  if (data.ksefNumber || data.ksefVerificationUrl) {
    sectionTitle("KSeF");
    if (data.ksefNumber) value("Numer KSeF: " + data.ksefNumber);
    if (data.ksefVerificationUrl) value("Link weryfikacyjny: " + data.ksefVerificationUrl);
  }

  if (data.footerNote) {
    sectionTitle("Stopka faktury");
    value(data.footerNote, { wrap: 170 });
  }

  return doc.output("arraybuffer") as ArrayBuffer;
}

/** Parsuje XML FA i zwraca bufor PDF lub null przy błędzie. */
export async function faXmlToPdf(xmlString: string): Promise<ArrayBuffer | null> {
  const data = parseFaXmlToInvoiceData(xmlString);
  if (!data) return null;
  return generatePdfFromFaData(data);
}
