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
};

const COMPANY_KEYS = ["company_name", "company_nip", "company_address", "company_postal_code", "company_city"] as const;

export async function getCompanySettings(): Promise<CompanySettings> {
  const [name, nip, address, postalCode, city] = await Promise.all([
    getSetting("company_name"),
    getSetting("company_nip"),
    getSetting("company_address"),
    getSetting("company_postal_code"),
    getSetting("company_city"),
  ]);
  return {
    name: name?.trim() || "",
    nip: nip?.trim() || "",
    address: address?.trim() || "",
    postalCode: postalCode?.trim() || "",
    city: city?.trim() || "",
  };
}

export async function setCompanySettings(data: CompanySettings): Promise<void> {
  const keys = COMPANY_KEYS;
  const values = [data.name, data.nip, data.address, data.postalCode, data.city];
  for (let i = 0; i < keys.length; i++) {
    await setSetting(keys[i], values[i] ?? "");
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
