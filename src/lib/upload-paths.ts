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
 * Odczytuje plik załącznika. Próbuje storedPath, potem ścieżkę względną UPLOAD_BASE
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
