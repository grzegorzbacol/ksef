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

/** Wyciąga dane z Podmiot1 (sprzedawca) i Podmiot2 (nabywca) – NIP, Nazwa z DaneIdentyfikacyjne. */
function collectPartyData(parsed: unknown): {
  sellerNip?: string;
  sellerName?: string;
  sellerAddress?: string;
  sellerContact?: string;
  buyerNip?: string;
  buyerName?: string;
  buyerAddress?: string;
  buyerContact?: string;
} {
  const out: {
    sellerNip?: string;
    sellerName?: string;
    sellerAddress?: string;
    sellerContact?: string;
    buyerNip?: string;
    buyerName?: string;
    buyerAddress?: string;
    buyerContact?: string;
  } = {};
  function extractDaneId(dane: unknown): { nip?: string; nazwa?: string } {
    if (dane == null || typeof dane !== "object") return {};
    const o = dane as Record<string, unknown>;
    let nip = getFirstText(o.NIP ?? o.nip);
    if (!nip) {
      const ident = getNested(dane, "Identyfikator") ?? getNested(dane, "Identifier");
      if (ident && typeof ident === "object") {
        nip = getFirstText((ident as Record<string, unknown>).NrID ?? (ident as Record<string, unknown>).nrId);
      }
    }
    const nazwa = getFirstText(o.Nazwa ?? o.nazwa);
    return { nip: nip || undefined, nazwa: nazwa || undefined };
  }
  function walk(n: unknown, depth: number): void {
    if (n == null || typeof n !== "object" || depth > 15) return;
    const o = n as Record<string, unknown>;
    for (const [tag, val] of Object.entries(o)) {
      const clean = stripNs(tag);
      if (clean === "Podmiot1" && val && typeof val === "object") {
        const v = val as Record<string, unknown>;
        const dane = getNested(val, "DaneIdentyfikacyjne") ?? getNested(val, "daneIdentyfikacyjne");
        const id = extractDaneId(dane);
        if (id.nip) out.sellerNip = id.nip;
        if (id.nazwa) out.sellerName = id.nazwa;
        const adres = getNested(val, "Adres");
        if (adres && typeof adres === "object") out.sellerAddress = formatAddress(adres as Record<string, unknown>);
        const kontakt = getFirstText(getNested(val, "DaneKontaktowe") ?? getNested(val, "Email") ?? getNested(val, "Telefon"));
        if (kontakt) out.sellerContact = kontakt;
      }
      if (clean === "Podmiot2" && val && typeof val === "object") {
        const dane = getNested(val, "DaneIdentyfikacyjne") ?? getNested(val, "daneIdentyfikacyjne");
        const id = extractDaneId(dane);
        if (id.nip) out.buyerNip = id.nip;
        if (id.nazwa) out.buyerName = id.nazwa;
        const adres = getNested(val, "Adres");
        if (adres && typeof adres === "object") out.buyerAddress = formatAddress(adres as Record<string, unknown>);
        const kontakt = getFirstText(getNested(val, "DaneKontaktowe") ?? getNested(val, "Email") ?? getNested(val, "Telefon"));
        if (kontakt) out.buyerContact = kontakt;
      }
      if (val && typeof val === "object") {
        if (Array.isArray(val)) val.forEach((item) => walk(item, depth + 1));
        else walk(val, depth + 1);
      }
    }
  }
  walk(parsed, 0);
  return out;
}

/** Wyciąga z sekcji Fa: P_1 (data), P_2 (numer), P_13_1 (netto), P_14_1 (VAT), P_15 (brutto). */
function extractFaAmounts(parsed: unknown): {
  number?: string;
  issueDate?: string;
  saleDate?: string;
  netAmount?: number;
  vatAmount?: number;
  grossAmount?: number;
  currency?: string;
} {
  const fa = getNested(parsed, "Fa") ?? getNested(parsed, "fa");
  if (fa == null || typeof fa !== "object") return {};
  const o = fa as Record<string, unknown>;
  const p1 = getFirstText(o.P_1);
  const p2 = getFirstText(o.P_2);
  const p6 = getFirstText(o.P_6);
  const p13_1 = getFirstNum(o.P_13_1);
  const p14_1 = getFirstNum(o.P_14_1);
  const p15 = getFirstNum(o.P_15);
  const waluta = getFirstText(o.KodWaluty);
  return {
    number: p2 || undefined,
    issueDate: p1 || p6 || undefined,
    netAmount: p13_1 || 0,
    vatAmount: p14_1 || 0,
    grossAmount: p15 || 0,
    currency: waluta || "PLN",
  };
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

// Uwaga: W FA(3) P_13_1, P_14_1, P_15 w sekcji Fa to KWOTY (netto, VAT, brutto), nie dane podmiotów!
const TEXT_KEYS = [
  "P_1", "P_2", "P_2_1", "P_3_1", "P_4_1", "P_4_2",
  "Numer", "DataWystawienia", "DataSprzedazy", "Waluta",
  "FormaPlatnosci", "TerminPlatnosci", "NumerRachunku", "SWIFT", "NazwaBanku",
  "NumerKlienta", "NumerUmowy",
  "KRS", "REGON", "NumerKSeF", "LinkWeryfikacyjny", "StopkaFaktury",
];

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
  collect(parsed, text, num, TEXT_KEYS, []);

  const fa = extractFaAmounts(parsed);
  const party = collectPartyData(parsed);

  const number = fa.number || text.P_2 || text.P_2_1 || text.Numer || "";
  const issueDate = (fa.issueDate || text.P_2_1 || text.DataWystawienia || text.P_1 || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const saleDate = text.P_3_1 || text.DataSprzedazy || undefined;
  const dateFrom = text.P_4_1 || undefined;
  const dateTo = text.P_4_2 || undefined;
  const sellerNip = party.sellerNip || "—";
  const sellerName = party.sellerName || "—";
  const buyerNip = party.buyerNip || "—";
  const buyerName = party.buyerName || "—";
  const netAmount = fa.netAmount ?? 0;
  const vatAmount = fa.vatAmount ?? 0;
  const grossAmount = fa.grossAmount ?? (netAmount + vatAmount);
  const currency = fa.currency || text.Waluta || "PLN";

  const items = collectLines(parsed);
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

function formatMoney(value: number): string {
  return value.toFixed(2).replace(".", ",");
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
  const margin = 14;
  const pageW = 210;
  const pageH = 297;
  const contentW = pageW - margin * 2;
  let y = margin;
  const lineH = 5;
  const labelSize = 8;
  const valueSize = 9;
  const titleSize = 17;
  const muted = [95, 95, 95] as const;
  const primary = [24, 40, 72] as const;

  const base64 = await getUnicodeFontBase64();
  doc.addFileToVFS("DejaVuSans.ttf", base64);
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.setFont("DejaVu", "normal");

  function ensurePageSpace(space: number): void {
    if (y + space > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function sectionTitle(title: string): void {
    ensurePageSpace(12);
    doc.setFontSize(10);
    doc.setTextColor(...primary);
    doc.text(title.toUpperCase(), margin, y);
    y += 2;
    doc.setDrawColor(210, 218, 232);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 1, pageW - margin, y + 1);
    y += 7;
  }

  function writeBlockLabelValue(
    label: string,
    val: string,
    x: number,
    maxWidth: number,
    opts?: { valueOffset?: number }
  ): number {
    const valueOffset = opts?.valueOffset ?? 24;
    const labelX = x;
    const valueX = x + valueOffset;
    doc.setFontSize(labelSize);
    doc.setTextColor(...muted);
    doc.text(label, labelX, y);
    doc.setFontSize(valueSize);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(val || "—", Math.max(10, maxWidth - valueOffset));
    doc.text(lines, valueX, y);
    return Math.max(lineH, lines.length * 3.8);
  }

  function drawPartyCard(title: string, lines: Array<{ label: string; value?: string }>, x: number, width: number): number {
    const top = y;
    doc.setFillColor(247, 249, 253);
    doc.setDrawColor(223, 229, 239);
    doc.roundedRect(x, top, width, 40, 1.5, 1.5, "FD");
    let cardY = top + 6;
    doc.setFontSize(9);
    doc.setTextColor(...primary);
    doc.text(title, x + 3, cardY);
    cardY += 5;
    const oldY = y;
    y = cardY;
    lines.forEach((entry) => {
      const h = writeBlockLabelValue(entry.label, entry.value || "—", x + 3, width - 6);
      y += h;
    });
    const used = y - top;
    y = oldY;
    return Math.max(40, used + 4);
  }

  doc.setFontSize(titleSize);
  doc.setTextColor(...primary);
  doc.text("FAKTURA VAT", margin, y);
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`Nr: ${data.number}`, margin, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(`Data wystawienia: ${data.issueDate ? formatDatePl(data.issueDate) : "—"}`, pageW - margin, y, { align: "right" });
  doc.text(`Data sprzedaży: ${data.saleDate ? formatDatePl(data.saleDate) : "—"}`, pageW - margin, y + 5, { align: "right" });
  y += 14;

  sectionTitle("Strony transakcji");
  const colGap = 4;
  const cardW = (contentW - colGap) / 2;
  const leftH = drawPartyCard(
    "Sprzedawca",
    [
      { label: "Nazwa:", value: data.sellerName },
      { label: "NIP:", value: data.sellerNip },
      { label: "Adres:", value: data.sellerAddress || data.sellerCorrespondenceAddress || "—" },
      { label: "Kontakt:", value: data.sellerContact || "—" },
    ],
    margin,
    cardW
  );
  const rightH = drawPartyCard(
    "Nabywca",
    [
      { label: "Nazwa:", value: data.buyerName },
      { label: "NIP:", value: data.buyerNip },
      { label: "Adres:", value: data.buyerAddress || data.buyerCorrespondenceAddress || "—" },
      { label: "Kontakt:", value: data.buyerContact || "—" },
    ],
    margin + cardW + colGap,
    cardW
  );
  y += Math.max(leftH, rightH) + 3;

  sectionTitle("Pozycje faktury");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(`Waluta dokumentu: ${data.currency}`, margin, y);
  y += 5;

  const tableCols = [10, 68, 17, 14, 12, 14, 20, 20];
  const headers = ["Lp.", "Nazwa towaru lub usługi", "Cena netto", "Ilość", "Jm", "VAT", "Wartość netto", "Wartość VAT"];
  const drawTableHeader = () => {
    doc.setFillColor(239, 244, 253);
    doc.setDrawColor(213, 222, 239);
    doc.rect(margin, y - 4, contentW, 7, "FD");
    doc.setFontSize(7.5);
    doc.setTextColor(...primary);
    let x = margin + 1;
    headers.forEach((h, i) => {
      doc.text(h, x, y);
      x += tableCols[i];
    });
    y += 5;
  };
  drawTableHeader();

  data.items.forEach((it, idx) => {
    const nameLines = doc.splitTextToSize(it.name || "—", tableCols[1] - 2);
    const rowH = Math.max(6, nameLines.length * 3.5 + 1.5);
    if (y + rowH > pageH - margin - 22) {
      doc.addPage();
      y = margin;
      drawTableHeader();
    }
    doc.setDrawColor(233, 233, 233);
    doc.rect(margin, y - 3.5, contentW, rowH, "S");
    let x = margin + 1;
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(String(idx + 1), x, y);
    x += tableCols[0];
    doc.text(nameLines, x, y);
    x += tableCols[1];
    doc.text(formatMoney(it.unitPriceNet), x + tableCols[2] - 2, y, { align: "right" });
    x += tableCols[2];
    doc.text(it.quantity, x + tableCols[3] - 2, y, { align: "right" });
    x += tableCols[3];
    doc.text(it.unit, x + tableCols[4] - 2, y, { align: "right" });
    x += tableCols[4];
    doc.text(it.taxRate, x + tableCols[5] - 2, y, { align: "right" });
    x += tableCols[5];
    doc.text(formatMoney(it.net), x + tableCols[6] - 2, y, { align: "right" });
    x += tableCols[6];
    doc.text(formatMoney(it.vat), x + tableCols[7] - 2, y, { align: "right" });
    y += rowH;
  });

  y += 5;
  ensurePageSpace(30);
  const summaryW = 82;
  const summaryX = pageW - margin - summaryW;
  doc.setFillColor(247, 249, 253);
  doc.setDrawColor(223, 229, 239);
  doc.roundedRect(summaryX, y - 2, summaryW, 22, 1.5, 1.5, "FD");
  doc.setTextColor(...muted);
  doc.setFontSize(8);
  doc.text("Razem netto:", summaryX + 3, y + 3);
  doc.text("Razem VAT:", summaryX + 3, y + 9);
  doc.text("Do zapłaty:", summaryX + 3, y + 16);
  doc.setTextColor(0, 0, 0);
  doc.text(`${formatMoney(data.netAmount)} ${data.currency}`, summaryX + summaryW - 3, y + 3, { align: "right" });
  doc.text(`${formatMoney(data.vatAmount)} ${data.currency}`, summaryX + summaryW - 3, y + 9, { align: "right" });
  doc.setTextColor(...primary);
  doc.setFontSize(10);
  doc.text(`${formatMoney(data.grossAmount)} ${data.currency}`, summaryX + summaryW - 3, y + 16, { align: "right" });
  y += 24;

  if (data.taxSummary && data.taxSummary.length > 0) {
    sectionTitle("Podsumowanie stawek podatku");
    const sumCols = [30, 35, 35, 35];
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("Stawka", margin, y);
    doc.text("Kwota netto", margin + sumCols[0], y);
    doc.text("Kwota podatku", margin + sumCols[0] + sumCols[1], y);
    doc.text("Kwota brutto", margin + sumCols[0] + sumCols[1] + sumCols[2], y);
    y += lineH;
    doc.setTextColor(0, 0, 0);
    data.taxSummary.forEach((row) => {
      doc.text(row.rate, margin, y);
      doc.text(formatMoney(row.net), margin + sumCols[0] + sumCols[1] - 3, y, { align: "right" });
      doc.text(formatMoney(row.vat), margin + sumCols[0] + sumCols[1] + sumCols[2] - 3, y, { align: "right" });
      doc.text(formatMoney(row.gross), margin + sumCols[0] + sumCols[1] + sumCols[2] + sumCols[3] - 3, y, { align: "right" });
      y += lineH;
    });
    y += 3;
  }

  const paymentEntries = [
    data.paymentInfo ? `Informacja: ${data.paymentInfo}` : "",
    data.paymentForm ? `Forma: ${data.paymentForm}` : "",
    data.paymentDueDate ? `Termin: ${formatDatePl(data.paymentDueDate)}` : "",
    data.bankAccount ? `Rachunek: ${data.bankAccount}` : "",
    data.swift ? `SWIFT: ${data.swift}` : "",
    data.bankName ? `Bank: ${data.bankName}` : "",
  ].filter(Boolean);
  if (paymentEntries.length > 0) {
    sectionTitle("Płatność");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    y = splitLines(doc, paymentEntries.join("\n"), margin, y, contentW, 9) + 1;
  }

  const infoLines = [
    data.contractNumber ? `Numer umowy: ${data.contractNumber}` : "",
    data.krs ? `KRS: ${data.krs}` : "",
    data.regon ? `REGON: ${data.regon}` : "",
    data.ksefNumber ? `Numer KSeF: ${data.ksefNumber}` : "",
    data.ksefVerificationUrl ? `Link weryfikacyjny: ${data.ksefVerificationUrl}` : "",
    data.footerNote ? `Uwagi: ${data.footerNote}` : "",
  ].filter(Boolean);
  if (infoLines.length > 0) {
    sectionTitle("Dodatkowe informacje");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    y = splitLines(doc, infoLines.join("\n"), margin, y, contentW, 9);
  }

  return doc.output("arraybuffer") as ArrayBuffer;
}

/** Parsuje XML FA i zwraca bufor PDF lub null przy błędzie. */
export async function faXmlToPdf(xmlString: string): Promise<ArrayBuffer | null> {
  const data = parseFaXmlToInvoiceData(xmlString);
  if (!data) return null;
  return generatePdfFromFaData(data);
}
