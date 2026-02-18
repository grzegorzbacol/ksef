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
import type { PrismaClient } from "@prisma/client";

const UPLOAD_BASE = path.join(process.cwd(), "uploads", "invoice-mail");

export type MailInvoiceData = {
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

/** Próbuje wyciągnąć dane faktury z tekstu (np. z PDF). */
function extractInvoiceFromText(text: string, fromEmail: string): MailInvoiceData | null {
  const nipMatch = text.match(/\b(\d{10})\b/);
  const nip = nipMatch ? nipMatch[1] : "";
  const numMatch = text.match(/(?:FV|FK)\s*[\/\-]?\s*(\d{4})\s*[\/\-]\s*(\d+)/i)
    || text.match(/(\d{4})\s*[\/\-]\s*(\d+)\s*(?:FV|FK)?/i);
  const number = numMatch
    ? `FV/${numMatch[1] || numMatch[2]}/${String(numMatch[2] || numMatch[3] || "?").padStart(4, "0")}`
    : "";
  const dateMatch = text.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
  const issueDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}` : new Date().toISOString().slice(0, 10);
  const amounts = text.match(/[\d\s]+[.,]\d{2}\s*(?:PLN|zł|zl)/gi) || [];
  const parseAmount = (s: string) => parseFloat(s.replace(/[^\d,.]/g, "").replace(",", ".")) || 0;
  let grossAmount = 0;
  let netAmount = 0;
  let vatAmount = 0;
  for (const m of amounts) {
    const val = parseAmount(m);
    if (val > grossAmount) grossAmount = val;
  }
  if (grossAmount > 0) {
    vatAmount = Math.round(grossAmount * 0.23 * 100) / 100;
    netAmount = Math.round((grossAmount - vatAmount) * 100) / 100;
  }
  const nameMatch = text.match(/(?:Nazwa|Firma|Sprzedawca)[:\s]+([^\n\r]{3,80})/i);
  const sellerName = nameMatch ? nameMatch[1].trim().slice(0, 200) : (fromEmail || "Nieznany nadawca");
  return {
    number: number || `MAIL-${Date.now().toString(36)}`,
    issueDate,
    sellerName,
    sellerNip: nip,
    buyerName: "",
    buyerNip: "",
    netAmount,
    vatAmount,
    grossAmount,
    currency: "PLN",
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
    if (ct.includes("xml")) {
      try {
        const xml = att.content.toString("utf-8");
        const fa = parseFaXmlToInvoiceData(xml);
        if (fa) {
          invoiceData = {
            number: fa.number,
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
          };
          break;
        }
      } catch {
        /* ignore */
      }
    }
    if (ct.includes("pdf")) {
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
  try {
    await client.connect();
    const lock = await client.getMailboxLock(settings.imapFolder || "INBOX");
    try {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const uids = await client.search({ since }, { uid: true });
      if (!Array.isArray(uids) || uids.length === 0) return { success: true, imported: 0 };
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
            if (existing) continue;
          }

          const issueDate = new Date(parsed.invoice.issueDate);
          const prefix = "FK";
          const year = issueDate.getFullYear();
          let number = parsed.invoice.number;
          const isPlaceholder = !number || number.startsWith("MAIL-");
          if (isPlaceholder) {
            const key = `invoice_counter_cost_${year}`;
            const row = await prisma.setting.findUnique({ where: { key } });
            const nextSeq = (row?.value ? parseInt(row.value, 10) : 0) + 1;
            await prisma.setting.upsert({
              where: { key },
              create: { key, value: String(nextSeq) },
              update: { value: String(nextSeq) },
            });
            number = `${prefix}/${year}/${String(nextSeq).padStart(4, "0")}`;
          } else {
            const existing = await prisma.invoice.findUnique({ where: { number } });
            if (existing) {
              const key = `invoice_counter_cost_${year}`;
              const row = await prisma.setting.findUnique({ where: { key } });
              const nextSeq = (row?.value ? parseInt(row.value, 10) : 0) + 1;
              await prisma.setting.upsert({
                where: { key },
                create: { key, value: String(nextSeq) },
                update: { value: String(nextSeq) },
              });
              number = `${prefix}/${year}/${String(nextSeq).padStart(4, "0")}`;
            }
          }

          const inv = await prisma.invoice.create({
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
              source: "mail",
              emailSubject: parsed.emailSubject,
              emailBody: parsed.emailBody,
              emailFrom: parsed.emailFrom,
              emailReceivedAt: parsed.emailReceivedAt,
              emailMessageId: parsed.emailMessageId,
            },
          });

          await fs.mkdir(path.join(UPLOAD_BASE, inv.id), { recursive: true });
          for (const att of parsed.attachments) {
            const safeName = (att.filename || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
            const storedPath = path.join(UPLOAD_BASE, inv.id, safeName);
            await fs.writeFile(storedPath, att.content);
            await prisma.invoiceEmailAttachment.create({
              data: {
                invoiceId: inv.id,
                filename: att.filename || safeName,
                contentType: att.contentType,
                size: att.content.length,
                storedPath,
              },
            });
          }
          imported++;
        } catch (err) {
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

  return { success: true, imported };
}
