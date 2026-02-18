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
  queryPath: string;
  sendPath: string;
  nip: string;
}> {
  const [apiUrl, token, queryPath, sendPath, nip] = await Promise.all([
    getSetting("ksef_api_url"),
    getSetting("ksef_token"),
    getSetting("ksef_query_path"),
    getSetting("ksef_send_path"),
    getSetting("ksef_nip"),
  ]);
  return {
    apiUrl: apiUrl?.trim() || "",
    token: token?.trim() || "",
    queryPath: queryPath?.trim() || "",
    sendPath: sendPath?.trim() || "",
    nip: nip?.trim() || "",
  };
}
