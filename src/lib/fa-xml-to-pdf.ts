/**
 * Konwersja faktury w formacie FA (XML z KSEF) na PDF.
 * Parsuje typowe pola FA(2)/FA(3) i generuje prosty PDF.
 */

import { XMLParser } from "fast-xml-parser";
import { jsPDF } from "jspdf";

type FaInvoiceData = {
  number: string;
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
  items: { name: string; quantity: string; unit: string; net: number; vat: number }[];
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
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Rekursywnie zbiera pierwsze wystąpienia znanych kluczy (bez namespace). */
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

/** Zbiera wiersze FaWiersz (lub Wiersz). */
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
  "P_1",
  "P_2_1",
  "P_3_1",
  "P_13_1",
  "P_14_1",
  "P_15_1",
  "P_16_1",
  "Numer",
  "DataWystawienia",
  "DataSprzedazy",
  "NIP",
  "Nazwa",
  "Waluta",
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
  const sellerNip = text.P_13_1 || text.NIP || "—";
  const sellerName = text.P_14_1 || text.Nazwa || "—";
  const buyerNip = text.P_15_1 || "—";
  const buyerName = text.P_16_1 || "—";
  const netAmount = num.P_13_2 || num.KwotaNetto || 0;
  const vatAmount = num.P_14_2 || num.KwotaVAT || 0;
  const grossAmount = num.P_15_2 || num.KwotaBrutto || netAmount + vatAmount;
  const currency = text.Waluta || "PLN";

  const items = collectLines(parsed);
  if (!number && !sellerNip && !buyerNip) return null;

  return {
    number: number || "—",
    issueDate: issueDate.slice(0, 10),
    saleDate: saleDate?.slice(0, 10),
    sellerName: sellerName || "—",
    sellerNip: sellerNip || "—",
    buyerName: buyerName || "—",
    buyerNip: buyerNip || "—",
    netAmount,
    vatAmount,
    grossAmount,
    currency,
    items: items.length ? items : [{ name: "—", quantity: "1", unit: "szt.", net: netAmount, vat: vatAmount }],
  };
}

export function generatePdfFromFaData(data: FaInvoiceData): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  let y = margin;
  const lineH = 6;
  const smallH = 5;

  function addLine(text: string, opts?: { size?: number; bold?: boolean }) {
    const size = opts?.size ?? 10;
    doc.setFontSize(size);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.text(text, margin, y);
    y += lineH;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Faktura ${data.number}`, margin, y);
  y += lineH + 4;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  addLine(`Data wystawienia: ${data.issueDate}`);
  if (data.saleDate) addLine(`Data sprzedaży: ${data.saleDate}`);
  y += 4;

  addLine("Sprzedawca:", { bold: true });
  addLine(data.sellerName, { size: 10 });
  addLine(`NIP: ${data.sellerNip}`, { size: 9 });
  y += 4;

  addLine("Nabywca:", { bold: true });
  addLine(data.buyerName, { size: 10 });
  addLine(`NIP: ${data.buyerNip}`, { size: 9 });
  y += 6;

  if (data.items.length > 0) {
    addLine("Pozycje:", { bold: true });
    const colW = [80, 20, 25, 25, 25];
    const headers = ["Nazwa", "Ilość", "Cena netto", "Netto", "VAT"];
    doc.setFont("helvetica", "bold");
    let x = margin;
    headers.forEach((h, i) => {
      doc.text(h, x, y);
      x += colW[i];
    });
    y += lineH;
    doc.setFont("helvetica", "normal");
    for (const it of data.items) {
      if (y > 260) {
        doc.addPage();
        y = margin;
      }
      x = margin;
      doc.text((it.name || "—").substring(0, 40), x, y);
      x += colW[0];
      doc.text(`${it.quantity} ${it.unit}`, x, y);
      x += colW[1];
      doc.text("", x, y);
      x += colW[2];
      doc.text(it.net.toFixed(2), x, y);
      x += colW[3];
      doc.text(it.vat.toFixed(2), x, y);
      y += smallH;
    }
    y += 4;
  }

  addLine(`Razem netto: ${data.netAmount.toFixed(2)} ${data.currency}`);
  addLine(`VAT: ${data.vatAmount.toFixed(2)} ${data.currency}`);
  addLine(`Razem brutto: ${data.grossAmount.toFixed(2)} ${data.currency}`, { bold: true });

  return doc.output("arraybuffer") as ArrayBuffer;
}

/** Parsuje XML FA i zwraca bufor PDF lub null przy błędzie. */
export function faXmlToPdf(xmlString: string): ArrayBuffer | null {
  const data = parseFaXmlToInvoiceData(xmlString);
  if (!data) return null;
  return generatePdfFromFaData(data);
}
