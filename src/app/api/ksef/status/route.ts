import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isKsefConfigured } from "@/lib/ksef";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configured = await isKsefConfigured();
  return NextResponse.json({ configured });
}
