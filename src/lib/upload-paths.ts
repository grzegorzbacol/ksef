/**
 * Ścieżki i odczyt plików załączników z maili.
 * Zapewnia spójną logikę między mail-fetch, download i attachments API.
 */
import path from "path";
import fs from "fs/promises";

export const UPLOAD_BASE = path.join(process.cwd(), "uploads", "invoice-mail");

/** Sanityzuje nazwę pliku do bezpiecznej wersji na dysku. */
export function safeFilename(filename: string): string {
  return (filename || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Pobiera treść załącznika. Preferuje content z bazy (działa na Vercel),
 * w przeciwnym razie czyta z dysku (self-hosting).
 */
export async function getAttachmentContent(
  attachment: {
    content?: Buffer | null;
    storedPath: string;
    filename: string;
  },
  invoiceId: string
): Promise<Buffer> {
  if (attachment.content && attachment.content.length > 0) {
    return Buffer.isBuffer(attachment.content)
      ? attachment.content
      : Buffer.from(attachment.content);
  }
  return readAttachmentFile(
    attachment.storedPath,
    invoiceId,
    attachment.filename
  );
}

/**
 * Odczytuje plik załącznika z dysku. Próbuje storedPath, potem ścieżkę względną UPLOAD_BASE
 * (gdy storedPath zapisano z innym process.cwd(), np. przy deployu).
 */
export async function readAttachmentFile(
  storedPath: string,
  invoiceId: string,
  filename: string
): Promise<Buffer> {
  const pathsToTry = [
    storedPath,
    path.join(UPLOAD_BASE, invoiceId, safeFilename(filename)),
    path.resolve(process.cwd(), storedPath),
  ];
  let lastError: unknown;
  for (const p of pathsToTry) {
    try {
      return await fs.readFile(p);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
