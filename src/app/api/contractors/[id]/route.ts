import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  nip: z.string().min(1).optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const contractor = await prisma.contractor.findUnique({ where: { id } });
  if (!contractor) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(contractor);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const raw = await req.json();
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Błąd walidacji" }, { status: 400 });
  }

  const data = parsed.data;
  const contractor = await prisma.contractor.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.nip !== undefined && { nip: data.nip.trim().replace(/\s/g, "") }),
      ...(data.address !== undefined && { address: data.address.trim() || null }),
      ...(data.postalCode !== undefined && { postalCode: data.postalCode.trim() || null }),
      ...(data.city !== undefined && { city: data.city.trim() || null }),
    },
  });
  return NextResponse.json(contractor);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.contractor.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
