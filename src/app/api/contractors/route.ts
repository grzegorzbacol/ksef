import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Nazwa jest wymagana"),
  nip: z.string().min(1, "NIP jest wymagany"),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await prisma.contractor.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json();
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join(" ") || "Błąd walidacji";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const contractor = await prisma.contractor.create({
    data: {
      name: parsed.data.name.trim(),
      nip: parsed.data.nip.trim().replace(/\s/g, ""),
      address: parsed.data.address?.trim() || null,
      postalCode: parsed.data.postalCode?.trim() || null,
      city: parsed.data.city?.trim() || null,
    },
  });
  return NextResponse.json(contractor);
}
