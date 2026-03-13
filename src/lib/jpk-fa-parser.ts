/**
 * Parser pliku JPK_FA (Jednolity Plik Kontrolny – faktury VAT).
 * Obsługuje wersje JPK_FA(1), JPK_FA(2), JPK_FA(3).
 * Struktura: Naglowek, Podmiot1, Faktura[], FakturaWiersz[].
 */

import { XMLParser } from "fast-xml-parser";

export type JpkFaInvoice = {
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
  items: {
    name: string;
    quantity: number;
    unit: string;
    unitPriceNet: number;
    vatRate: number;
    amountNet: number;
    amountVat: number;
  }[];
};

function stripNs(tag: string): string {
  const i = tag.indexOf(":");
  return i > 0 ? tag.slice(i + 1) : tag;
}

function getText(obj: unknown): string {
  if (obj == null) return "";
  if (typeof obj === "string") return String(obj).trim();
  if (typeof obj === "number") return String(obj);
  if (Array.isArray(obj)) return getText(obj[0]);
  if (typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    if (o["#text"] != null) return String(o["#text"]).trim();
  }
  return "";
}

function getNum(obj: unknown): number {
  const s = getText(obj);
  const n = parseFloat(String(s).replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function findInTree(obj: unknown, tagName: string): unknown[] {
  const results: unknown[] = [];
  const target = stripNs(tagName);
  function walk(n: unknown, depth: number) {
    if (n == null || typeof n !== "object" || depth > 20) return;
    const o = n as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      if (stripNs(k) === target) {
        if (Array.isArray(v)) results.push(...v);
        else if (v != null) results.push(v);
      }
      if (v && typeof v === "object") {
        if (Array.isArray(v)) v.forEach((x) => walk(x, depth + 1));
        else walk(v, depth + 1);
      }
    }
  }
  walk(obj, 0);
  return results;
}

function getFirstInTree(obj: unknown, tagName: string): unknown {
  const items = findInTree(obj, tagName);
  return items[0];
}

/** Dane jednej faktury z sekcji Faktura */
function parseFakturaNode(node: Record<string, unknown>, defaultSellerNip: string, defaultSellerName: string): Partial<JpkFaInvoice> | null {
  const p2a = getText(node.P_2A ?? node.p_2A);
  const p1 = getText(node.P_1 ?? node.p_1);
  const p6 = getText(node.P_6 ?? node.p_6);
  const p3a = getText(node.P_3A ?? node.p_3A);  // nabywca
  const p5b = getText(node.P_5B ?? node.p_5B);  // NIP nabywcy
  const p3c = getText(node.P_3C ?? node.p_3C);  // sprzedawca
  const p4b = getText(node.P_4B ?? node.p_4B);  // NIP sprzedawcy
  const p15 = getNum(node.P_15 ?? node.p_15);

  const p13_1 = getNum(node.P_13_1 ?? node.p_13_1);
  const p13_2 = getNum(node.P_13_2 ?? node.p_13_2);
  const p13_3 = getNum(node.P_13_3 ?? node.p_13_3);
  const p13_4 = getNum(node.P_13_4 ?? node.p_13_4);
  const p13_5 = getNum(node.P_13_5 ?? node.p_13_5);
  const p13_6 = getNum(node.P_13_6 ?? node.p_13_6);
  const p13_7 = getNum(node.P_13_7 ?? node.p_13_7);

  const p14_1 = getNum(node.P_14_1 ?? node.p_14_1);
  const p14_2 = getNum(node.P_14_2 ?? node.p_14_2);
  const p14_3 = getNum(node.P_14_3 ?? node.p_14_3);
  const p14_4 = getNum(node.P_14_4 ?? node.p_14_4);
  const p14_5 = getNum(node.P_14_5 ?? node.p_14_5);

  const netAmount = p13_1 + p13_2 + p13_3 + p13_4 + p13_5 + p13_6 + p13_7;
  const vatAmount = p14_1 + p14_2 + p14_3 + p14_4 + p14_5;
  const grossAmount = p15 > 0 ? p15 : netAmount + vatAmount;

  if (!p2a && !p3a && !p5b) return null;

  const issueDate = (p1 || p6 || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const saleDate = p6 ? p6.slice(0, 10) : undefined;

  return {
    number: p2a || "—",
    issueDate,
    saleDate: saleDate !== issueDate ? saleDate : undefined,
    sellerName: p3c || defaultSellerName,
    sellerNip: (p4b || defaultSellerNip).replace(/\D/g, "").slice(0, 10) || defaultSellerNip,
    buyerName: p3a || "—",
    buyerNip: (p5b || "").replace(/\D/g, "").slice(0, 10),
    netAmount,
    vatAmount,
    grossAmount,
    currency: getText(node.KodWaluty ?? node.kodWaluty) || "PLN",
    items: [],
  };
}

/** Wiersze z FakturaWiersz – P_2B łączy z numerem faktury */
function parseFakturaWierszNodes(nodes: unknown[], invoicesByNumber: Map<string, JpkFaInvoice>) {
  for (const n of nodes) {
    if (n == null || typeof n !== "object") continue;
    const r = n as Record<string, unknown>;
    const p2b = getText(r.P_2B ?? r.p_2B);
    const inv = p2b ? invoicesByNumber.get(p2b) : undefined;
    if (!inv) continue;

    const name = getText(r.P_7 ?? r.p_7) || "—";
    const unit = getText(r.P_8A ?? r.p_8A) || "szt.";
    const quantity = getNum(r.P_8B ?? r.p_8B) || 1;
    const unitPriceNet = getNum(r.P_9A ?? r.p_9A);
    const amountNet = getNum(r.P_11 ?? r.p_11);
    const vatRateStr = getText(r.P_12 ?? r.p_12);
    const vatRate = parseFloat(String(vatRateStr).replace(",", ".")) || 23;
    const amountVat = quantity > 0 && unitPriceNet > 0
      ? quantity * unitPriceNet * (vatRate / 100)
      : getNum(r.P_12_1 ?? r.p_12_1) || 0;

    const up = unitPriceNet > 0 ? unitPriceNet : quantity > 0 ? amountNet / quantity : amountNet;
    inv.items.push({
      name,
      quantity,
      unit,
      unitPriceNet: up,
      vatRate,
      amountNet: amountNet || quantity * up,
      amountVat: amountVat || 0,
    });
  }
}

/** Dane podatnika z Podmiot1 – domyślny sprzedawca */
function getPodmiot1Defaults(parsed: unknown): { nip: string; name: string } {
  const podmiot1 = getFirstInTree(parsed, "Podmiot1");
  if (podmiot1 == null || typeof podmiot1 !== "object") return { nip: "", name: "" };

  const o = podmiot1 as Record<string, unknown>;
  const ident = o.IdentyfikatorPodmiotu ?? o.identyfikatorPodmiotu;
  let nip = "";
  let name = "";

  if (ident && typeof ident === "object") {
    const id = ident as Record<string, unknown>;
    nip = getText(id.NIP ?? id.nip);
    name = getText(id.PelnaNazwa ?? id.pelnaNazwa ?? id.Nazwa ?? id.nazwa);
  }
  return { nip: nip.replace(/\D/g, "").slice(0, 10), name: name || "" };
}

/**
 * Parsuje plik JPK_FA (XML) i zwraca listę faktur sprzedaży.
 */
export function parseJpkFa(xmlString: string): JpkFaInvoice[] {
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
    return [];
  }

  const { nip: defaultNip, name: defaultName } = getPodmiot1Defaults(parsed);

  const faktury = findInTree(parsed, "Faktura");
  const fakturyWiersze = findInTree(parsed, "FakturaWiersz");

  const invoices: JpkFaInvoice[] = [];
  const byNumber = new Map<string, JpkFaInvoice>();

  for (const f of faktury) {
    if (f == null || typeof f !== "object") continue;
    const inv = parseFakturaNode(
      f as Record<string, unknown>,
      defaultNip,
      defaultName
    );
    if (!inv) continue;

    const full: JpkFaInvoice = {
      number: inv.number ?? "—",
      issueDate: inv.issueDate ?? new Date().toISOString().slice(0, 10),
      saleDate: inv.saleDate,
      sellerName: (inv.sellerName ?? defaultName) || "—",
      sellerNip: (inv.sellerNip ?? defaultNip) || "—",
      buyerName: inv.buyerName ?? "—",
      buyerNip: inv.buyerNip ?? "—",
      netAmount: inv.netAmount ?? 0,
      vatAmount: inv.vatAmount ?? 0,
      grossAmount: inv.grossAmount ?? 0,
      currency: inv.currency ?? "PLN",
      items: [],
    };

    invoices.push(full);
    byNumber.set(full.number, full);
  }

  parseFakturaWierszNodes(fakturyWiersze, byNumber);

  // Gdy brak pozycji – dodaj jedną wierszową pozycję
  for (const inv of invoices) {
    if (inv.items.length === 0) {
      inv.items.push({
        name: "—",
        quantity: 1,
        unit: "szt.",
        unitPriceNet: inv.netAmount,
        vatRate: inv.netAmount > 0 ? (inv.vatAmount / inv.netAmount) * 100 : 23,
        amountNet: inv.netAmount,
        amountVat: inv.vatAmount,
      });
    }
  }

  return invoices;
}
