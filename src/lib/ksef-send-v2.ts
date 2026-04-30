/**
 * Wysyłka faktury do KSeF 2.0 – sesja interaktywna, szyfrowanie AES-256 + RSA-OAEP.
 * Dokumentacja: https://github.com/CIRFMF/ksef-docs/blob/main/sesja-interaktywna.md
 */

import * as crypto from "crypto";

const FA3_NS = "http://crd.gov.pl/wzor/2025/06/25/13775/";

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
  /** Numer rachunku bankowego sprzedawcy do sekcji Platnosc/NrRB */
  sellerBankAccount?: string | null;
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

/** Generuje minimalny FA(3) XML zgodny ze schematem (obowiązuje od 1.02.2026). Wymaga paymentDueDate. */
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
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const items = inv.items ?? [];
  const nipS = (inv.sellerNip ?? "").replace(/\D/g, "");
  const nipB = (inv.buyerNip ?? "").replace(/\D/g, "");
  if (nipS.length !== 10) throw new Error("NIP sprzedawcy musi mieć 10 cyfr.");
  if (nipB.length !== 10) throw new Error("NIP nabywcy jest wymagany i musi mieć 10 cyfr. Uzupełnij dane nabywcy w fakturze.");
  const curr = (inv.currency ?? "PLN").trim() || "PLN";
  const gross = Number(inv.grossAmount) || 0;
  const sellerBankAccount = String(inv.sellerBankAccount ?? "").replace(/\s/g, "");
  const isPlnVatWithNipsOverLimit =
    curr.toUpperCase() === "PLN" && gross >= 15000 && nipS.length === 10 && nipB.length === 10;
  if (isPlnVatWithNipsOverLimit && !sellerBankAccount) {
    throw new Error(
      "Dla faktury VAT w PLN z kwotą brutto co najmniej 15 000 zł i NIP nabywcy wymagany jest numer rachunku bankowego (NrRB). Uzupełnij go w Ustawieniach firmy."
    );
  }

  const fullAddr = (
    addr: string | null | undefined,
    postal: string | null | undefined,
    city: string | null | undefined
  ) => {
    const a = (addr ?? "").trim() || "ul. Nieznana 1";
    const p = (postal ?? "").trim();
    const c = (city ?? "").trim() || "Warszawa";
    const post = p && /^\d{2}-\d{3}$/.test(p) ? p : "01-001";
    return `${a}, ${post} ${c}`;
  };
  const sellerAddr = fullAddr(inv.sellerAddress, inv.sellerPostalCode, inv.sellerCity);
  const buyerAddr = fullAddr(inv.buyerAddress, inv.buyerPostalCode, inv.buyerCity);
  const sellerCity = (inv.sellerCity ?? "").trim() || "Warszawa";

  const rows = items.map(
    (it, i) => {
      const qty = Number(it.quantity) || 1;
      const amt = Number(it.amountNet) || 0;
      const unitPrice = Number(it.unitPriceNet) || (qty > 0 ? amt / qty : 0);
      const vatRate = Math.round(Number(it.vatRate) ?? 23);
      return `
    <FaWiersz>
      <NrWierszaFa>${i + 1}</NrWierszaFa>
      <P_7>${escXml(it.name || "Pozycja")}</P_7>
      <P_8A>${escXml(it.unit || "szt.")}</P_8A>
      <P_8B>${qty}</P_8B>
      <P_9A>${unitPrice.toFixed(2)}</P_9A>
      <P_11>${(Number(it.amountNet) || 0).toFixed(2)}</P_11>
      <P_11Vat>${(Number(it.amountVat) || 0).toFixed(2)}</P_11Vat>
      <P_12>${vatRate}</P_12>
    </FaWiersz>`;
    }
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="${FA3_NS}">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
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
      <AdresL1>${escXml(sellerAddr)}</AdresL1>
    </Adres>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>${escXml(nipB)}</NIP>
      <Nazwa>${escXml(inv.buyerName || "Nabywca")}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>${escXml(buyerAddr)}</AdresL1>
    </Adres>
    <JST>2</JST>
    <GV>2</GV>
  </Podmiot2>
  <Fa>
    <KodWaluty>${escXml(curr)}</KodWaluty>
    <P_1>${issueDate}</P_1>
    <P_2>${escXml(inv.number || `FA/${Date.now()}`)}</P_2>
    <P_6>${saleDate}</P_6>
    <P_13_1>${(Number(inv.netAmount) || 0).toFixed(2)}</P_13_1>
    <P_14_1>${(Number(inv.vatAmount) || 0).toFixed(2)}</P_14_1>
    <P_15>${gross.toFixed(2)}</P_15>
    <Adnotacje>
      <P_16>2</P_16>
      <P_17>2</P_17>
      <P_18>2</P_18>
      <P_18A>2</P_18A>
      <Zwolnienie>
        <P_19N>1</P_19N>
      </Zwolnienie>
      <NoweSrodkiTransportu>
        <P_22N>1</P_22N>
      </NoweSrodkiTransportu>
      <P_23>2</P_23>
      <PMarzy>
        <P_PMarzyN>1</P_PMarzyN>
      </PMarzy>
    </Adnotacje>
    <RodzajFaktury>VAT</RodzajFaktury>
    ${rows.length > 0 ? rows.join("\n") : ""}
    <Platnosc>
      <TerminPlatnosci>
        <Termin>${paymentDue}</Termin>
      </TerminPlatnosci>
      ${sellerBankAccount ? `<RachunekBankowy><NrRB>${escXml(sellerBankAccount)}</NrRB></RachunekBankowy>` : ""}
    </Platnosc>
  </Fa>
</Faktura>`;
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

/** Szyfruje dane AES-256-CBC. IV wysyłany osobno przy otwarciu sesji – encryptedInvoiceContent = tylko szyfrogram. */
export function encryptAes256Cbc(data: Buffer, key: Buffer, iv: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([cipher.update(data), cipher.final()]);
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
  const ciphertext = encryptAes256Cbc(xmlBuf, encData.key, encData.iv);
  const invoiceHash = sha256Base64(xmlBuf);
  const invoiceSize = xmlBuf.length;
  const encryptedHash = sha256Base64(ciphertext);
  const encryptedSize = ciphertext.length;
  const encryptedContent = ciphertext.toString("base64");

  const openRes = await fetch(`${baseV2}/sessions/online`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      formCode: { systemCode: "FA (3)", schemaVersion: "1-0E", value: "FA" },
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
      const j = JSON.parse(t) as Record<string, unknown>;
      const parts = [
        j.message,
        j.exceptionDescription,
        j.details,
        Array.isArray(j.exceptionMessageList)
          ? (j.exceptionMessageList as string[]).join("; ")
          : null,
      ].filter(Boolean) as string[];
      if (parts.length > 0) err = parts.join(" | ");
    } catch {
      if (t) err += ` – ${t.slice(0, 300)}`;
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
