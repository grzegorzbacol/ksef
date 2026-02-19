import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UPLOAD_BASE, safeFilename } from "@/lib/upload-paths";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "Nie znaleziono faktury" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Brak danych formularza" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Wybierz plik do załączenia" }, { status: 400 });
  }

  const safeName = safeFilename(file.name || "file");
  if (!safeName) {
    return NextResponse.json({ error: "Nieprawidłowa nazwa pliku" }, { status: 400 });
  }

  const storedPath = path.join(UPLOAD_BASE, id, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await prisma.invoiceEmailAttachment.create({
    data: {
      invoiceId: id,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: buffer.length,
      storedPath,
      content: buffer,
    },
  });

  return NextResponse.json({ ok: true, filename: file.name });
}
