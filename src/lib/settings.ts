import { prisma } from "./prisma";

const CACHE: Record<string, string> = {};

export async function getSetting(key: string): Promise<string | null> {
  if (CACHE[key] !== undefined) return CACHE[key] || null;
  const row = await prisma.setting.findUnique({ where: { key } });
  const val = row?.value ?? null;
  CACHE[key] = val ?? "";
  return val;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  CACHE[key] = value;
}

export async function getKsefSettings(): Promise<{
  apiUrl: string;
  token: string;
  refreshToken: string;
  queryPath: string;
  sendPath: string;
  nip: string;
  invoicePdfPath: string;
}> {
  const [apiUrl, token, refreshToken, queryPath, sendPath, nip, invoicePdfPath] = await Promise.all([
    getSetting("ksef_api_url"),
    getSetting("ksef_token"),
    getSetting("ksef_refresh_token"),
    getSetting("ksef_query_path"),
    getSetting("ksef_send_path"),
    getSetting("ksef_nip"),
    getSetting("ksef_invoice_pdf_path"),
  ]);
  return {
    apiUrl: apiUrl?.trim() || "",
    token: token?.trim() || "",
    refreshToken: refreshToken?.trim() || "",
    queryPath: queryPath?.trim() || "",
    sendPath: sendPath?.trim() || "",
    nip: nip?.trim() || "",
    invoicePdfPath: invoicePdfPath?.trim() || "",
  };
}

export type CompanySettings = {
  name: string;
  nip: string;
  address: string;
  postalCode: string;
  city: string;
  /** Stawka PIT – skala (0.12 lub 0.32) */
  pitRate: number;
  /** Stawka składki zdrowotnej (domyślnie 0.09) */
  healthRate: number;
  /** Czy firma jest płatnikiem VAT */
  isVatPayer: boolean;
};

const COMPANY_KEYS = [
  "company_name",
  "company_nip",
  "company_address",
  "company_postal_code",
  "company_city",
  "company_pit_rate",
  "company_health_rate",
  "company_is_vat_payer",
] as const;

function parseCompanyNum(val: string | null, defaultVal: number): number {
  if (val == null || val.trim() === "") return defaultVal;
  const n = parseFloat(val.replace(",", "."));
  return Number.isNaN(n) ? defaultVal : n;
}

function parseCompanyBool(val: string | null, defaultVal: boolean): boolean {
  if (val == null || val.trim() === "") return defaultVal;
  return val !== "false" && val !== "0";
}

export async function getCompanySettings(): Promise<CompanySettings> {
  const [name, nip, address, postalCode, city, pitRate, healthRate, isVatPayer] = await Promise.all([
    getSetting("company_name"),
    getSetting("company_nip"),
    getSetting("company_address"),
    getSetting("company_postal_code"),
    getSetting("company_city"),
    getSetting("company_pit_rate"),
    getSetting("company_health_rate"),
    getSetting("company_is_vat_payer"),
  ]);
  return {
    name: name?.trim() || "",
    nip: nip?.trim() || "",
    address: address?.trim() || "",
    postalCode: postalCode?.trim() || "",
    city: city?.trim() || "",
    pitRate: parseCompanyNum(pitRate ?? null, 0.12),
    healthRate: parseCompanyNum(healthRate ?? null, 0.09),
    isVatPayer: parseCompanyBool(isVatPayer ?? null, true),
  };
}

export async function setCompanySettings(data: CompanySettings): Promise<void> {
  const values = [
    data.name ?? "",
    data.nip ?? "",
    data.address ?? "",
    data.postalCode ?? "",
    data.city ?? "",
    String(data.pitRate ?? 0.12),
    String(data.healthRate ?? 0.09),
    data.isVatPayer !== false ? "true" : "false",
  ];
  for (let i = 0; i < COMPANY_KEYS.length; i++) {
    await setSetting(COMPANY_KEYS[i], values[i] ?? "");
  }
}

export type MailSettings = {
  imapHost: string;
  imapPort: string;
  imapUser: string;
  imapPassword: string;
  imapSecure: boolean;
  imapFolder: string;
  emailAddress: string; // adres na który przychodzą faktury
};

const MAIL_KEYS = [
  "mail_imap_host",
  "mail_imap_port",
  "mail_imap_user",
  "mail_imap_password",
  "mail_imap_secure",
  "mail_imap_folder",
  "mail_email_address",
] as const;

export async function getMailSettings(): Promise<MailSettings> {
  const [imapHost, imapPort, imapUser, imapPassword, imapSecure, imapFolder, emailAddress] = await Promise.all(
    MAIL_KEYS.map((k) => getSetting(k))
  );
  return {
    imapHost: imapHost?.trim() || "",
    imapPort: imapPort?.trim() || "993",
    imapUser: imapUser?.trim() || "",
    imapPassword: imapPassword?.trim() || "",
    imapSecure: imapSecure !== "false" && imapSecure !== "0",
    imapFolder: imapFolder?.trim() || "INBOX",
    emailAddress: emailAddress?.trim() || "",
  };
}

export async function setMailSettings(data: MailSettings): Promise<void> {
  const values = [
    data.imapHost,
    data.imapPort,
    data.imapUser,
    data.imapPassword,
    data.imapSecure ? "true" : "false",
    data.imapFolder,
    data.emailAddress,
  ];
  for (let i = 0; i < MAIL_KEYS.length; i++) {
    await setSetting(MAIL_KEYS[i], values[i] ?? "");
  }
}

const PAYMENT_REMINDER_EMAIL_KEY = "payment_reminder_email";
const DEFAULT_REMINDER_EMAIL = "grzegorz@bacol.pl";

export async function getPaymentReminderEmail(): Promise<string> {
  const v = await getSetting(PAYMENT_REMINDER_EMAIL_KEY);
  return (v?.trim() || DEFAULT_REMINDER_EMAIL) || DEFAULT_REMINDER_EMAIL;
}

export async function setPaymentReminderEmail(email: string): Promise<void> {
  await setSetting(PAYMENT_REMINDER_EMAIL_KEY, (email || DEFAULT_REMINDER_EMAIL).trim());
}

export type SmtpSettings = {
  host: string;
  port: string;
  user: string;
  password: string;
  from: string;
  secure: boolean;
};

const SMTP_KEYS = [
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_password",
  "smtp_from",
  "smtp_secure",
] as const;

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const [host, port, user, password, from, secure] = await Promise.all(
    SMTP_KEYS.map((k) => getSetting(k))
  );
  return {
    host: host?.trim() || "",
    port: port?.trim() || "587",
    user: user?.trim() || "",
    password: password?.trim() || "",
    from: from?.trim() || "",
    secure: secure === "true" || secure === "1",
  };
}

export async function setSmtpSettings(data: SmtpSettings): Promise<void> {
  const values = [
    data.host,
    data.port,
    data.user,
    data.password,
    data.from,
    data.secure ? "true" : "false",
  ];
  for (let i = 0; i < SMTP_KEYS.length; i++) {
    await setSetting(SMTP_KEYS[i], values[i] ?? "");
  }
}
