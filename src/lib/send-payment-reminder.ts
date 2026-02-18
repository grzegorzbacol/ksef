import nodemailer from "nodemailer";
import { prisma } from "./prisma";
import { getPaymentReminderEmail, getSmtpSettings } from "./settings";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Znajduje faktury kosztowe z terminem płatności = dzisiaj, jeszcze nie opłacone.
 */
export async function getDueTodayInvoices() {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  return prisma.invoice.findMany({
    where: {
      type: "cost",
      paymentDueDate: { gte: todayStart, lte: todayEnd },
      payment: null,
    },
    orderBy: { number: "asc" },
  });
}

/**
 * Wysyła e-mail z przypomnieniem o rozrachunkach z terminem dzisiaj.
 * Zwraca { sent: number, error?: string }.
 */
export async function sendPaymentReminderEmails(): Promise<{
  sent: number;
  error?: string;
}> {
  const [invoices, toEmail, smtp] = await Promise.all([
    getDueTodayInvoices(),
    getPaymentReminderEmail(),
    getSmtpSettings(),
  ]);

  if (invoices.length === 0) {
    return { sent: 0 };
  }

  if (!toEmail) {
    return { sent: 0, error: "Nie ustawiono adresu e-mail na przypomnienia." };
  }

  if (!smtp.host || !smtp.user) {
    return {
      sent: 0,
      error: "Nie skonfigurowano SMTP w ustawieniach (Przypomnienia o terminie płatności).",
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: parseInt(smtp.port || "587", 10),
    secure: smtp.secure,
    auth: smtp.user && smtp.password ? { user: smtp.user, pass: smtp.password } : undefined,
  });

  const from = smtp.from || smtp.user || "noreply@localhost";
  const subject = `Przypomnienie: ${invoices.length} rozrachunków z terminem płatności dziś`;
  const lines = invoices.map(
    (inv) =>
      `- ${inv.number} | ${inv.sellerName} | ${inv.grossAmount.toFixed(2)} ${inv.currency}`
  );
  const text = `Dziś przypada termin płatności dla następujących rozrachunków:\n\n${lines.join("\n")}\n\nZaloguj się do aplikacji, aby je rozliczyć.`;

  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      text,
    });
    return { sent: 1 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { sent: 0, error: `Błąd wysyłki e-mail: ${message}` };
  }
}
