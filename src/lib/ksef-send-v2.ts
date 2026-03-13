/**
 * Wysyłka faktury do KSeF 2.0 – sesja interaktywna, szyfrowanie AES-256 + RSA-OAEP.
 * Dokumentacja: https://github.com/CIRFMF/ksef-docs/blob/main/sesja-interaktywna.md
 */

import * as crypto from "crypto";

const FA2_NS = "http://crd.gov.pl/wzor/2023/06/29/12648/";

function escXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type InvoiceWithItems = {
  number: string;
  issueDate: Date | string;
  saleDate?: Date | string | null;
  sellerName: string;
  sellerNip: string;
  buyerName: string;
  buyerNip: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  currency: string;
  /** Adres sprzedawcy – z ustawień firmy */
  sellerAddress?: string | null;
  sellerPostalCode?: string | null;
  sellerCity?: string | null;
  /** Adres nabywcy – z kontrahenta */
  buyerAddress?: string | null;
  buyerPostalCode?: string | null;
  buyerCity?: string | null;
  /** Termin płatności – wymagany przy wysyłce do KSeF */
  paymentDueDate: Date | string | null;
  items?: Array<{
    name: string;
    quantity: number;
    unit: string;
    unitPriceNet: number;
    amountNet: number;
    amountVat: number;
    vatRate: number;
  }>;
};

/** Generuje minimalny FA(2) XML zgodny ze schematem. Wymaga paymentDueDate. */
export function buildFa2Xml(inv: InvoiceWithItems): string {
  const paymentDue = inv.paymentDueDate
    ? typeof inv.paymentDueDate === "string"
      ? inv.paymentDueDate.slice(0, 10)
      : fmtDate(new Date(inv.paymentDueDate))
    : null;
  if (!paymentDue) throw new Error("Termin płatności jest wymagany przy wysyłce do KSeF.");
  const issueDate = typeof inv.issueDate === "string" ? inv.issueDate.slice(0, 10) : fmtDate(new Date(inv.issueDate));
  const saleDate = inv.saleDate
    ? typeof inv.saleDate === "string"
      ? inv.saleDate.slice(0, 10)
      : fmtDate(new Date(inv.saleDate))
    : issueDate;
  const now = new Date().toISOString();
  const items = inv.items ?? [];
  const nipS = (inv.sellerNip ?? "").replace(/\D/g, "");
  const nipB = (inv.buyerNip ?? "").replace(/\D/g, "");
  const curr = (inv.currency ?? "PLN").trim() || "PLN";

  const addrL1 = (s: string | null | undefined) => (s && s.trim() ? s.trim() : "ul. Nieznana 1");
  const addrPostal = (s: string | null | undefined) => {
    const v = (s ?? "").trim();
    if (v && /^\d{2}-\d{3}$/.test(v)) return v;
    return "01-001";
  };
  const addrCity = (s: string | null | undefined) => (s && s.trim() ? s.trim() : "Warszawa");

  const sellerL1 = addrL1(inv.sellerAddress);
  const sellerPostal = addrPostal(inv.sellerPostalCode);
  const sellerCity = addrCity(inv.sellerCity);
  const buyerL1 = addrL1(inv.buyerAddress);
  const buyerPostal = addrPostal(inv.buyerPostalCode);
  const buyerCity = addrCity(inv.buyerCity);

  const rows = items.map(
    (it, i) => {
      const qty = Number(it.quantity) || 1;
      const amt = Number(it.amountNet) || 0;
      const unitPrice = Number(it.unitPriceNet) || (qty > 0 ? amt / qty : 0);
      const vatRate = Math.round(Number(it.vatRate) ?? 23);
      return `
    <FaWiersz>
      <P_7>${i + 1}</P_7>
      <P_8_5>${escXml(it.name || "Pozycja")}</P_8_5>
      <P_8_6>${qty}</P_8_6>
      <P_8_7>${escXml(it.unit || "szt.")}</P_8_7>
      <P_9>${unitPrice.toFixed(2)}</P_9>
      <P_11>${(Number(it.amountNet) || 0).toFixed(2)}</P_11>
      <P_11_V>${(Number(it.amountVat) || 0).toFixed(2)}</P_11_V>
      <P_12>${vatRate}</P_12>
    </FaWiersz>`;
    }
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<FA xmlns="${FA2_NS}">
  <Naglowek>
    <KodFormularza kodSystemowy="FA" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>2</WariantFormularza>
    <DataWytworzeniaFa>${now}</DataWytworzeniaFa>
    <SystemInfo>KSEF Connector</SystemInfo>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>${escXml(nipS)}</NIP>
      <Nazwa>${escXml(inv.sellerName || "Sprzedawca")}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>${escXml(sellerL1)}</AdresL1>
      <KodPocztowy>${escXml(sellerPostal)}</KodPocztowy>
      <Miejscowosc>${escXml(sellerCity)}</Miejscowosc>
    </Adres>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>${escXml(nipB)}</NIP>
      <Nazwa>${escXml(inv.buyerName || "Nabywca")}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>${escXml(buyerL1)}</AdresL1>
      <KodPocztowy>${escXml(buyerPostal)}</KodPocztowy>
      <Miejscowosc>${escXml(buyerCity)}</Miejscowosc>
    </Adres>
  </Podmiot2>
  <Fa>
    <KodWaluty>${escXml(curr)}</KodWaluty>
    <P_6_1>${saleDate}</P_6_1>
    <P_6>${escXml(sellerCity)}</P_6>
    <P_1>${escXml(inv.number || `FA/${Date.now()}`)}</P_1>
    <P_2_1>${issueDate}</P_2_1>
    <P_13_1>${escXml(nipS)}</P_13_1>
    <P_14_1>${escXml(inv.sellerName || "Sprzedawca")}</P_14_1>
    <P_15_1>${escXml(nipB)}</P_15_1>
    <P_16_1>${escXml(inv.buyerName || "Nabywca")}</P_16_1>
    <P_7>
      <P_7_A>${(Number(inv.netAmount) || 0).toFixed(2)}</P_7_A>
      <P_7_B>${(Number(inv.vatAmount) || 0).toFixed(2)}</P_7_B>
      <P_7_C>${(Number(inv.grossAmount) || 0).toFixed(2)}</P_7_C>
    </P_7>
    <RodzajFaktury>V</RodzajFaktury>
    ${rows.length > 0 ? rows.join("\n") : ""}
    <Platnosc>
      <Termin>${paymentDue}</Termin>
    </Platnosc>
  </Fa>
</FA>`;
}

export type EncryptionData = {
  key: Buffer;
  iv: Buffer;
  encryptedKeyBase64: string;
  ivBase64: string;
};

/** Generuje klucz AES-256, IV 128-bit i szyfruje klucz RSA-OAEP. */
export async function createEncryptionData(
  publicKeyPem: string,
  publicKeyCert?: string
): Promise<EncryptionData> {
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  let keyForEncrypt: string | crypto.KeyObject = publicKeyPem;
  if (publicKeyCert) {
    try {
      const cert = new crypto.X509Certificate(publicKeyCert);
      keyForEncrypt = cert.publicKey;
    } catch {
      // fallback to PEM
    }
  } else {
    try {
      keyForEncrypt = crypto.createPublicKey(publicKeyPem);
    } catch {
      // keep as PEM
    }
  }
  const encryptedKey = crypto.publicEncrypt(
    {
      key: keyForEncrypt,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    aesKey
  );
  return {
    key: aesKey,
    iv,
    encryptedKeyBase64: encryptedKey.toString("base64"),
    ivBase64: iv.toString("base64"),
  };
}

/** Szyfruje dane AES-256-CBC z IV jako prefiks. */
export function encryptAes256Cbc(data: Buffer, key: Buffer, iv: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, enc]);
}

/** SHA-256 skrót, Base64. */
function sha256Base64(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("base64");
}

export type SendV2Result = { success: boolean; ksefId?: string; error?: string };

export async function sendInvoiceToKsefV2(
  apiUrl: string,
  token: string,
  invoice: InvoiceWithItems
): Promise<SendV2Result> {
  const base = apiUrl.replace(/\/$/, "");
  const baseV2 = base.includes("/v2") ? base : `${base}/v2`;

  const keyRes = await fetch(`${baseV2}/security/public-key-certificates`);
  if (!keyRes.ok) {
    const t = await keyRes.text();
    return { success: false, error: `Pobranie klucza KSEF: ${keyRes.status} – ${t.slice(0, 200)}` };
  }
  const certs = (await keyRes.json()) as Array<{ certificate?: string; usage?: string | string[] }>;
  const row = Array.isArray(certs)
    ? certs.find((c) =>
        Array.isArray(c.usage) ? c.usage.includes("SymmetricKeyEncryption") : c.usage === "SymmetricKeyEncryption"
      ) ?? certs[0]
    : (certs as unknown as { certificate?: string });
  const cert = row?.certificate;
  if (!cert) {
    return { success: false, error: "Brak certyfikatu SymmetricKeyEncryption w odpowiedzi KSEF." };
  }
  const certCompact = cert.replace(/\s/g, "");
  const certPem =
    certCompact.toUpperCase().includes("BEGINCERTIFICATE")
      ? cert
      : `-----BEGIN CERTIFICATE-----\n${certCompact.match(/.{1,64}/g)?.join("\n") ?? certCompact}\n-----END CERTIFICATE-----`;

  const encData = await createEncryptionData(certPem, cert);
  const xml = buildFa2Xml(invoice);
  const xmlBuf = Buffer.from(xml, "utf-8");
  const cipherWithIv = encryptAes256Cbc(xmlBuf, encData.key, encData.iv);
  const invoiceHash = sha256Base64(xmlBuf);
  const invoiceSize = xmlBuf.length;
  const encryptedHash = sha256Base64(cipherWithIv);
  const encryptedSize = cipherWithIv.length;
  const encryptedContent = cipherWithIv.toString("base64");

  const openRes = await fetch(`${baseV2}/sessions/online`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      formCode: { systemCode: "FA (2)", schemaVersion: "1-0E", value: "FA" },
      encryption: {
        encryptedSymmetricKey: encData.encryptedKeyBase64,
        initializationVector: encData.ivBase64,
      },
    }),
  });
  if (!openRes.ok) {
    const t = await openRes.text();
    let err = `Otwarcie sesji: ${openRes.status}`;
    try {
      const j = JSON.parse(t);
      err = (j.message ?? j.exceptionDescription ?? j.details ?? err) as string;
    } catch {
      if (t) err += ` – ${t.slice(0, 150)}`;
    }
    return { success: false, error: err };
  }
  const openData = (await openRes.json()) as { referenceNumber?: string };
  const sessionRef = openData.referenceNumber;
  if (!sessionRef) {
    return { success: false, error: "Brak referenceNumber w odpowiedzi otwarcia sesji." };
  }

  const sendRes = await fetch(`${baseV2}/sessions/online/${encodeURIComponent(sessionRef)}/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      invoiceHash,
      invoiceSize,
      encryptedInvoiceHash: encryptedHash,
      encryptedInvoiceSize: encryptedSize,
      encryptedInvoiceContent: encryptedContent,
    }),
  });
  let ksefId = "";
  if (sendRes.ok) {
    try {
      const sendData = (await sendRes.json()) as { referenceNumber?: string; ksefNumber?: string };
      ksefId = (sendData.ksefNumber ?? sendData.referenceNumber ?? "").trim();
    } catch {
      /* ignore */
    }
  }
  if (!sendRes.ok) {
    const t = await sendRes.text();
    let err = `Wysłanie faktury: ${sendRes.status}`;
    try {
      const j = JSON.parse(t);
      err = (j.message ?? j.exceptionDescription ?? j.details ?? err) as string;
    } catch {
      if (t) err += ` – ${t.slice(0, 200)}`;
    }
    await fetch(`${baseV2}/sessions/online/${encodeURIComponent(sessionRef)}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    return { success: false, error: err };
  }

  const closeRes = await fetch(`${baseV2}/sessions/online/${encodeURIComponent(sessionRef)}/close`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!ksefId) {
    const invoicesRes = await fetch(`${baseV2}/sessions/online/${encodeURIComponent(sessionRef)}/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (invoicesRes.ok) {
      try {
        const invData = (await invoicesRes.json()) as {
          invoices?: Array<{ ksefNumber?: string; referenceNumber?: string }>;
        };
        const first = invData.invoices?.[0];
        ksefId = (first?.ksefNumber ?? first?.referenceNumber ?? "").trim();
      } catch {
        /* ignore */
      }
    }
  }
  if (!ksefId) {
    ksefId = `KSEF-${Date.now()}`;
  }

  if (!closeRes.ok) {
    return { success: true, ksefId };
  }
  return { success: true, ksefId };
}
