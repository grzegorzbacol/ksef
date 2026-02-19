/**
 * Moduł pobierania faktur z skrzynki e-mail (IMAP).
 * Parsuje maile, wyciąga dane z załączników (XML FA, PDF) i tworzy faktury z source=mail.
 */

import { ImapFlow } from "imapflow";
import { simpleParser, Attachment } from "mailparser";
import path from "path";
import fs from "fs/promises";
import { getMailSettings, getCompanySettings } from "./settings";
import { parseFaXmlToInvoiceData } from "./fa-xml-to-pdf";
import { UPLOAD_BASE, safeFilename } from "./upload-paths";
import type { PrismaClient } from "@prisma/client";

export type MailInvoiceItem = {
  name: string;
  quantity: number;
  unit: string;
  unitPriceNet: number;
  vatRate: number;
  amountNet: number;
  amountVat: number;
};

export type MailInvoiceData = {
  number: string;
  ksefId?: string | null;
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
  items?: MailInvoiceItem[];
};

export type ParsedEmailInvoice = {
  invoice: MailInvoiceData;
  emailSubject: string;
  emailBody: string;
  emailFrom: string;
  emailReceivedAt: Date;
  emailMessageId: string | null;
  attachments: { filename: string; contentType: string; content: Buffer }[];
};

function parseAmount(s: string): number {
  const cleaned = String(s || "").replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function toIsoDate(s: string): string {
  const m1 = s.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  const m2 = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  return "";
}

/** Parser faktur KSEF z PDF – format VWFS, LEO CMS i podobne. */
function extractInvoiceFromText(text: string, fromEmail: string): MailInvoiceData | null {
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);

  let number = "";
  let ksefId: string | null = null;
  let issueDate = "";
  let saleDate = "";
  let sellerNip = "";
  let sellerName = "";
  let buyerNip = "";
  let buyerName = "";
  let netAmount = 0;
  let vatAmount = 0;
  let grossAmount = 0;
  const currency = "PLN";
  const items: MailInvoiceItem[] = [];

  // Numer faktury: "Numer Faktury:" / "Numer Faktury" + następna linia np. 50262/0226/RM
  const numMatch = t.match(/Numer\s+Faktury\s*:?\s*\n?\s*(\d+[\/\-]\d+[\/\-][A-Za-z0-9]+)/i)
    || t.match(/(\d{4,6}\/\d{2,4}\/[A-Za-z0-9]+)/);
  if (numMatch) number = numMatch[1].trim();

  // Numer KSEF
  const ksefMatch = t.match(/Numer\s+KSEF\s*:?\s*([A-Za-z0-9\-]+)/i);
  if (ksefMatch) ksefId = ksefMatch[1].trim();

  // Data wystawienia: 05.02.2026
  const issueMatch = t.match(/Data\s+wystawienia[^:]*:\s*(\d{1,2}[.\-]\d{1,2}[.\-]\d{4})/i)
    || t.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*(?:Data|$)/m);
  if (issueMatch) {
    issueDate = issueMatch[1] && issueMatch[1].length > 8
      ? toIsoDate(issueMatch[1])
      : issueMatch[2] && issueMatch[3]
        ? `${issueMatch[3]}-${issueMatch[2].padStart(2, "0")}-${issueMatch[1].padStart(2, "0")}`
        : "";
  }
  if (!issueDate) {
    const anyDate = t.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (anyDate) issueDate = toIsoDate(anyDate[0]);
  }

  // Data dostawy: od 2026-01-21 do 2026-02-20 – bierzemy datę "do"
  const saleMatch = t.match(/(?:do|do:)\s*(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/i)
    || t.match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})\s*$/m);
  if (saleMatch) {
    saleDate = saleMatch[1] && saleMatch[1].length === 4
      ? `${saleMatch[1]}-${saleMatch[2].padStart(2, "0")}-${saleMatch[3].padStart(2, "0")}`
      : saleMatch[0] ? toIsoDate(saleMatch[0].replace(/[do:\s]/gi, "")) : "";
  }

  // Sprzedawca i Nabywca – sekcje NIP / Nazwa
  const sellerIdx = t.search(/\bSprzedawca\b/i);
  const buyerIdx = t.search(/\bNabywca\b/i);
  const sellerBlock = sellerIdx >= 0 ? t.slice(sellerIdx, buyerIdx >= 0 ? buyerIdx : undefined) : "";
  const buyerBlock = buyerIdx >= 0 ? t.slice(buyerIdx, t.indexOf("Szczegóły", buyerIdx) >= 0 ? t.indexOf("Szczegóły", buyerIdx) : undefined) : t.slice(buyerIdx);

  const nipRe = /NIP\s*:?\s*(\d{10})/gi;
  const nazwaRe = /Nazwa\s*:?\s*([^\n]+?)(?=\s*(?:Adres|NIP|Numer|Prefiks|Dane|$))/gi;
  const nips: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = nipRe.exec(t)) !== null) nips.push(m[1]);
  if (nips.length >= 1) sellerNip = nips[0];
  if (nips.length >= 2) buyerNip = nips[1];

  const names: string[] = [];
  const nazwaGlobal = /Nazwa\s*:?\s*([^\n]+?)(?=\n(?:Adres|NIP|Numer|Prefiks|Dane|E-mail|Kraj|Polska|Tel\.|$))/gi;
  while ((m = nazwaGlobal.exec(t)) !== null) {
    const name = m[1].trim().replace(/\s+/g, " ").slice(0, 250);
    if (name && name.length > 2) names.push(name);
  }
  if (names.length >= 1) sellerName = names[0];
  if (names.length >= 2) buyerName = names[1];

  if (!sellerName && fromEmail) sellerName = fromEmail;

  // Kwota należności ogółem: 2100,34 PLN
  const grossMatch = t.match(/Kwota\s+należności\s+ogółem\s*:?\s*([\d\s,\.]+)\s*PLN/i)
    || t.match(/Razem\s*(?:brutto|do\s+zapłaty)\s*:?\s*([\d\s,\.]+)\s*PLN/i)
    || t.match(/Kwota\s+brutto\s*:?\s*([\d\s,\.]+)/i);
  if (grossMatch) grossAmount = parseAmount(grossMatch[1]);

  // Podsumowanie stawek: 23% ... netto, vat, brutto
  const sumMatch = t.match(/(\d+)%\s*(?:lub[^%]*)?\s*([\d\s,\.]+)\s+([\d\s,\.]+)\s+([\d\s,\.]+)/);
  if (sumMatch) {
    const a = parseAmount(sumMatch[2]);
    const b = parseAmount(sumMatch[3]);
    const c = parseAmount(sumMatch[4]);
    if (c > 0) {
      grossAmount = grossAmount || c;
      vatAmount = vatAmount || b;
      netAmount = netAmount || a;
    }
  }
  if (grossAmount > 0 && (netAmount === 0 || vatAmount === 0)) {
    vatAmount = vatAmount || Math.round(grossAmount * 0.23 / 1.23 * 100) / 100;
    netAmount = netAmount || Math.round((grossAmount - vatAmount) * 100) / 100;
  }

  // Pozycje – format KSEF/LEO: lp nazwa cena ilość szt. rabat vat% wart_netto wart_vat (może być wieloliniowy)
  const posStart = t.search(/Lp\.\s+Nazwa\s+towaru/i) || t.search(/Pozycje\s*\n/i);
  const posEnd = t.search(/Kwota\s+należności|Podsumowanie|Razem\s+netto|Dodatkowe\s+informacje/i) || t.length;
  let posBlock = posStart >= 0 ? t.slice(posStart, posEnd) : t;
  posBlock = posBlock.replace(/\n\s*(\d)\s*\n/g, "$1"); // łącz oderwane cyfry z poprzedniej linii
  posBlock = posBlock.replace(/\n/g, " "); // scal linie dla łatwiejszego dopasowania
  // Szukaj wzorca: vat% wart_netto wart_vat – unikalny dla każdej pozycji
  const chunkRe = /(\d+)\s+(.+?)\s+([\d\s,\.]+)\s+([\d\s,\.]+)\s+szt\.\s+[\d\s,\.]*\s*(\d+)%\s+([\d\s,\.]+)\s+([\d\s,\.]+)/g;
  let rowM: RegExpExecArray | null;
  while ((rowM = chunkRe.exec(posBlock)) !== null) {
    const lp = parseInt(rowM[1], 10);
    if (lp < 1 || lp > 999) continue;
    const name = rowM[2].replace(/\s+/g, " ").replace(/\n/g, " ").trim().slice(0, 300);
    const unitPriceNet = parseAmount(rowM[3]);
    const qty = parseAmount(rowM[4]) || 1;
    const vatRate = parseInt(rowM[5], 10) || 23;
    const amountNet = parseAmount(rowM[6]);
    const amountVat = parseAmount(rowM[7]);
    if (name.length >= 2 && (amountNet > 0 || amountVat > 0)) {
      items.push({
        name,
        quantity: qty,
        unit: "szt.",
        unitPriceNet: unitPriceNet > 0 ? unitPriceNet : amountNet / qty,
        vatRate,
        amountNet,
        amountVat,
      });
    }
  }
  // Fallback – gdy brak dopasowania pozycji, spróbuj wyłapać pary netto+VAT
  if (items.length === 0 && grossAmount > 0) {
    const tailRe = /(\d+)%\s+([\d\s,\.]+)\s+([\d\s,\.]+)(?=\s+\d+%|\s+Kwota|$)/g;
    let tailM: RegExpExecArray | null;
    let ti = 0;
    while ((tailM = tailRe.exec(posBlock)) !== null) {
      const vatRate = parseInt(tailM[1], 10) || 23;
      const amountNet = parseAmount(tailM[2]);
      const amountVat = parseAmount(tailM[3]);
      if (amountNet > 0 && amountNet < 1000000 && amountVat < 1000000) {
        items.push({
          name: `Pozycja ${ti + 1}`,
          quantity: 1,
          unit: "szt.",
          unitPriceNet: amountNet,
          vatRate,
          amountNet,
          amountVat,
        });
        ti++;
      }
    }
  }

  const hasData = number || sellerNip || buyerNip || grossAmount > 0 || items.length > 0;
  if (!hasData) return null;

  return {
    number: number || `MAIL-${Date.now().toString(36)}`,
    ksefId,
    issueDate: issueDate || new Date().toISOString().slice(0, 10),
    saleDate: saleDate || undefined,
    sellerName: sellerName || "Nieznany sprzedawca",
    sellerNip,
    buyerName,
    buyerNip,
    netAmount: netAmount || items.reduce((s, i) => s + i.amountNet, 0),
    vatAmount: vatAmount || items.reduce((s, i) => s + i.amountVat, 0),
    grossAmount: grossAmount || netAmount + vatAmount,
    currency,
    items: items.length > 0 ? items : undefined,
  };
}

/** Parsuje pojedynczy mail do struktury ParsedEmailInvoice. */
async function parseEmailToInvoice(
  raw: Buffer,
  fromAddress: string
): Promise<ParsedEmailInvoice | null> {
  const parsed = await simpleParser(raw);
  const subject = parsed.subject || "(brak tematu)";
  const from = parsed.from?.text || fromAddress;
  const date = parsed.date || new Date();
  const messageId = parsed.messageId || null;
  let body = "";
  if (parsed.text) body = parsed.text;
  else if (parsed.html) body = parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const attachments: { filename: string; contentType: string; content: Buffer }[] = [];
  if (parsed.attachments?.length) {
    for (const a of parsed.attachments) {
      if (a.content) {
        attachments.push({
          filename: (a as Attachment).filename || `załącznik-${attachments.length}`,
          contentType: (a as Attachment).contentType || "application/octet-stream",
          content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content as ArrayBuffer),
        });
      }
    }
  }

  let invoiceData: MailInvoiceData | null = null;

  for (const att of attachments) {
    const ct = att.contentType.toLowerCase();
    const fn = (att.filename || "").toLowerCase();
    const isXml = ct.includes("xml") || fn.endsWith(".xml");
    if (isXml) {
      try {
        const xml = att.content.toString("utf-8");
        const fa = parseFaXmlToInvoiceData(xml);
        if (fa) {
          invoiceData = {
            number: fa.number,
            ksefId: fa.ksefNumber || null,
            issueDate: fa.issueDate,
            saleDate: fa.saleDate,
            sellerName: fa.sellerName,
            sellerNip: fa.sellerNip,
            buyerName: fa.buyerName,
            buyerNip: fa.buyerNip,
            netAmount: fa.netAmount,
            vatAmount: fa.vatAmount,
            grossAmount: fa.grossAmount,
            currency: fa.currency,
            items: fa.items?.map((it) => ({
              name: it.name,
              quantity: parseFloat(String(it.quantity).replace(",", ".")) || 1,
              unit: it.unit || "szt.",
              unitPriceNet: it.net,
              vatRate: 23,
              amountNet: it.net,
              amountVat: it.vat,
            })),
          };
          break;
        }
      } catch {
        /* ignore */
      }
    }
    const isPdf = ct.includes("pdf") || fn.endsWith(".pdf");
    if (isPdf) {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(att.content);
        const text = data?.text || "";
        const extracted = extractInvoiceFromText(text, from);
        if (extracted && (extracted.grossAmount > 0 || extracted.number)) {
          invoiceData = extracted;
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (!invoiceData) {
    invoiceData = extractInvoiceFromText(body + " " + subject, from);
  }
  if (!invoiceData) {
    const company = await getCompanySettings();
    invoiceData = {
      number: `MAIL-${Date.now().toString(36)}`,
      issueDate: new Date().toISOString().slice(0, 10),
      sellerName: from || "Nieznany",
      sellerNip: "",
      buyerName: company.name || "—",
      buyerNip: company.nip || "",
      netAmount: 0,
      vatAmount: 0,
      grossAmount: 0,
      currency: "PLN",
    };
  }

  if (!invoiceData.buyerName || !invoiceData.buyerNip) {
    const company = await getCompanySettings();
    invoiceData.buyerName = invoiceData.buyerName || company.name || "—";
    invoiceData.buyerNip = invoiceData.buyerNip || company.nip || "";
  }

  return {
    invoice: invoiceData,
    emailSubject: subject,
    emailBody: body.slice(0, 50000),
    emailFrom: from,
    emailReceivedAt: date,
    emailMessageId: messageId,
    attachments,
  };
}

export type FetchMailResult = {
  success: boolean;
  imported?: number;
  error?: string;
  /** Diagnostyka – dlaczego 0 zaimportowanych */
  totalMails?: number;
  skippedAlreadyImported?: number;
  skippedDeleted?: number;
  failed?: number;
};

export async function fetchInvoicesFromMail(prisma: PrismaClient): Promise<FetchMailResult> {
  const settings = await getMailSettings();
  if (!settings.imapHost || !settings.imapUser || !settings.imapPassword) {
    return { success: false, error: "Skonfiguruj IMAP (host, użytkownik, hasło) w ustawieniach." };
  }

  const port = parseInt(settings.imapPort || "993", 10) || 993;
  const secure = settings.imapSecure !== false;

  const client = new ImapFlow({
    host: settings.imapHost,
    port,
    secure,
    auth: {
      user: settings.imapUser,
      pass: settings.imapPassword,
    },
    logger: false,
  });

  let imported = 0;
  let totalMails = 0;
  let skippedAlreadyImported = 0;
  let skippedDeleted = 0;
  let failed = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock(settings.imapFolder || "INBOX");
    try {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const uids = await client.search({ since }, { uid: true });
      totalMails = Array.isArray(uids) ? uids.length : 0;
      if (!Array.isArray(uids) || uids.length === 0) {
        return { success: true, imported: 0, totalMails: 0 };
      }
      const range = `${Math.min(...uids)}:${Math.max(...uids)}`;
      const list = client.fetch(range, { source: true, uid: true }, { uid: true });
      for await (const msg of list) {
        try {
          const raw = msg.source;
          if (!raw) continue;
          const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          const parsed = await parseEmailToInvoice(buffer, msg.envelope?.from?.[0]?.address || "");
          if (!parsed) continue;

          if (parsed.emailMessageId) {
            const existing = await prisma.invoice.findFirst({
              where: { emailMessageId: parsed.emailMessageId },
            });
            if (existing) {
              skippedAlreadyImported++;
              continue;
            }
            const wasDeleted = await prisma.deletedMailInvoiceMessageId.findUnique({
              where: { emailMessageId: parsed.emailMessageId },
            });
            if (wasDeleted) {
              skippedDeleted++;
              continue;
            }
          }

          const issueDate = new Date(parsed.invoice.issueDate);
          const prefix = "FK";
          const year = issueDate.getFullYear();

          const nextMailInvoiceNumber = async (): Promise<string> => {
            const key = `invoice_counter_cost_${year}`;
            const row = await prisma.setting.findUnique({ where: { key } });
            const nextSeq = (row?.value ? parseInt(row.value, 10) : 0) + 1;
            await prisma.setting.upsert({
              where: { key },
              create: { key, value: String(nextSeq) },
              update: { value: String(nextSeq) },
            });
            return `${prefix}/${year}/${String(nextSeq).padStart(4, "0")}`;
          };

          let number = parsed.invoice.number;
          const isPlaceholder = !number || number.startsWith("MAIL-");
          if (isPlaceholder) {
            number = await nextMailInvoiceNumber();
          } else {
            const existing = await prisma.invoice.findUnique({ where: { number } });
            if (existing) number = await nextMailInvoiceNumber();
          }

          let inv: Awaited<ReturnType<PrismaClient["invoice"]["create"]>>;
          const maxRetries = 3;
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              inv = await prisma.invoice.create({
                data: {
                  type: "cost",
                  number,
                  issueDate,
                  saleDate: parsed.invoice.saleDate ? new Date(parsed.invoice.saleDate) : null,
                  sellerName: parsed.invoice.sellerName,
                  sellerNip: parsed.invoice.sellerNip,
                  buyerName: parsed.invoice.buyerName,
                  buyerNip: parsed.invoice.buyerNip,
                  netAmount: parsed.invoice.netAmount,
                  vatAmount: parsed.invoice.vatAmount,
                  grossAmount: parsed.invoice.grossAmount,
                  currency: parsed.invoice.currency,
                  ksefId: parsed.invoice.ksefId || null,
                  ksefStatus: parsed.invoice.ksefId ? "received" : null,
                  source: "mail",
                  emailSubject: parsed.emailSubject,
                  emailBody: parsed.emailBody,
                  emailFrom: parsed.emailFrom,
                  emailReceivedAt: parsed.emailReceivedAt,
                  emailMessageId: parsed.emailMessageId,
                },
              });
              break;
            } catch (createErr: unknown) {
              const isUniqueError =
                createErr && typeof createErr === "object" && "code" in createErr && (createErr as { code: string }).code === "P2002";
              if (isUniqueError && attempt < maxRetries - 1) {
                number = await nextMailInvoiceNumber();
                continue;
              }
              throw createErr;
            }
          }
          const created = inv!;

          if (parsed.invoice.items && parsed.invoice.items.length > 0) {
            for (const row of parsed.invoice.items) {
              await prisma.invoiceItem.create({
                data: {
                  invoiceId: created.id,
                  name: row.name,
                  quantity: row.quantity,
                  unit: row.unit || "szt.",
                  unitPriceNet: row.unitPriceNet,
                  vatRate: row.vatRate,
                  amountNet: row.amountNet,
                  amountVat: row.amountVat,
                },
              });
            }
          }

          for (const att of parsed.attachments) {
            const safeName = safeFilename(att.filename || "file");
            const storedPath = path.join(UPLOAD_BASE, created.id, safeName);
            await prisma.invoiceEmailAttachment.create({
              data: {
                invoiceId: created.id,
                filename: att.filename || safeName,
                contentType: att.contentType,
                size: att.content.length,
                storedPath,
                content: att.content,
              },
            });
          }
          imported++;
        } catch (err) {
          failed++;
          console.error("mail-fetch: błąd przetwarzania wiadomości:", err);
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Błąd IMAP: ${msg}` };
  } finally {
    try {
      client.close();
    } catch {
      /* ignore */
    }
  }

  return {
    success: true,
    imported,
    totalMails,
    skippedAlreadyImported,
    skippedDeleted,
    failed,
  };
}
