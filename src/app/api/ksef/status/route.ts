import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isKsefConfigured } from "@/lib/ksef";
import { getKsefActiveEnv } from "@/lib/settings";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [configured, activeEnv] = await Promise.all([
    isKsefConfigured(),
    getKsefActiveEnv(),
  ]);
  return NextResponse.json({ configured, activeEnv });
}
