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

export type KsefEnv = "test" | "prod";

export type KsefSettingsData = {
  apiUrl: string;
  token: string;
  refreshToken: string;
  queryPath: string;
  sendPath: string;
  nip: string;
  invoicePdfPath: string;
};

const KSEF_KEYS = [
  "api_url",
  "token",
  "refresh_token",
  "query_path",
  "send_path",
  "nip",
  "invoice_pdf_path",
] as const;

function ksefKey(env: KsefEnv, key: (typeof KSEF_KEYS)[number]): string {
  return `ksef_${env}_${key}`;
}

/** Zwraca ustawienia KSeF dla danego środowiska. Dla prod: fallback na stare klucze (ksef_api_url itd.) dla kompatybilności wstecznej. */
export async function getKsefSettings(env?: KsefEnv): Promise<KsefSettingsData> {
  const targetEnv = env ?? (await getKsefActiveEnv());

  const prefixed = await Promise.all(
    KSEF_KEYS.map((k) => getSetting(ksefKey(targetEnv, k)))
  );

  // Dla prod: fallback na stare, nieprefiksowane klucze (migracja)
  let fallback: (string | null)[] = [];
  if (targetEnv === "prod") {
    fallback = await Promise.all([
      getSetting("ksef_api_url"),
      getSetting("ksef_token"),
      getSetting("ksef_refresh_token"),
      getSetting("ksef_query_path"),
      getSetting("ksef_send_path"),
      getSetting("ksef_nip"),
      getSetting("ksef_invoice_pdf_path"),
    ]);
  }

  const vals = KSEF_KEYS.map((_, i) => (prefixed[i]?.trim() || fallback[i]?.trim() || ""));

  return {
    apiUrl: vals[0] ?? "",
    token: vals[1] ?? "",
    refreshToken: vals[2] ?? "",
    queryPath: vals[3] ?? "",
    sendPath: vals[4] ?? "",
    nip: vals[5] ?? "",
    invoicePdfPath: vals[6] ?? "",
  };
}

/** Aktywne środowisko KSeF (używane domyślnie przy pobieraniu/wysyłaniu). */
export async function getKsefActiveEnv(): Promise<KsefEnv> {
  const v = await getSetting("ksef_active_env");
  return v === "test" ? "test" : "prod";
}

export async function setKsefActiveEnv(env: KsefEnv): Promise<void> {
  await setSetting("ksef_active_env", env);
}

/** Zapisuje ustawienia KSeF dla danego środowiska. */
export async function setKsefSettings(env: KsefEnv, data: Partial<KsefSettingsData>): Promise<void> {
  const keys: (keyof KsefSettingsData)[] = [
    "apiUrl",
    "token",
    "refreshToken",
    "queryPath",
    "sendPath",
    "nip",
    "invoicePdfPath",
  ];
  const keyMap: Record<string, (typeof KSEF_KEYS)[number]> = {
    apiUrl: "api_url",
    token: "token",
    refreshToken: "refresh_token",
    queryPath: "query_path",
    sendPath: "send_path",
    nip: "nip",
    invoicePdfPath: "invoice_pdf_path",
  };
  for (const k of keys) {
    if (data[k as keyof KsefSettingsData] !== undefined) {
      const val = data[k as keyof KsefSettingsData];
      if ((k === "token" || k === "refreshToken") && (val === "" || val === "********")) continue;
      await setSetting(ksefKey(env, keyMap[k]!), String(val ?? ""));
    }
  }
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
