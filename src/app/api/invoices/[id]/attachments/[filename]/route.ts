import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readAttachmentFile } from "@/lib/upload-paths";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, filename } = await params;
  const decodedFilename = decodeURIComponent(filename);

  const attachment = await prisma.invoiceEmailAttachment.findFirst({
    where: {
      invoiceId: id,
      filename: decodedFilename,
    },
  });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const content = await readAttachmentFile(
      attachment.storedPath,
      id,
      attachment.filename
    );
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": attachment.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${attachment.filename.replace(/"/g, '\\"')}"`,
      },
    });
  } catch (err) {
    console.error(
      "[attachments] Nie można odczytać pliku:",
      { storedPath: attachment.storedPath, invoiceId: id, err }
    );
    return NextResponse.json(
      { error: "Plik załącznika niedostępny." },
      { status: 404 }
    );
  }
}
