import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isKsefConfigured } from "@/lib/ksef";
import { getKsefActiveEnv, getKsefSettings } from "@/lib/settings";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [activeEnv, prod, test] = await Promise.all([
    getKsefActiveEnv(),
    getKsefSettings("prod"),
    getKsefSettings("test"),
  ]);
  const configured = await isKsefConfigured();
  const hasEnvVars = !!(process.env.KSEF_API_URL?.trim() && process.env.KSEF_TOKEN?.trim());
  const hasProd = !!(prod.apiUrl?.trim() || process.env.KSEF_API_URL) && !!(prod.token?.trim() || process.env.KSEF_TOKEN);
  const hasTest = !!(test.apiUrl?.trim() || process.env.KSEF_API_URL) && !!(test.token?.trim() || process.env.KSEF_TOKEN);
  return NextResponse.json({
    configured,
    activeEnv,
    _hint: !configured ? { hasEnvVars, hasProd, hasTest, activeEnv } : undefined,
  });
}
