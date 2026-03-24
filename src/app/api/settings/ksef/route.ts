import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getKsefSettings,
  getKsefActiveEnv,
  setKsefSettings,
  setKsefActiveEnv,
  type KsefEnv,
} from "@/lib/settings";

function maskToken(t: string) {
  return t ? "********" : "";
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [prod, test, activeEnv] = await Promise.all([
    getKsefSettings("prod"),
    getKsefSettings("test"),
    getKsefActiveEnv(),
  ]);

  return NextResponse.json({
    activeEnv,
    prod: {
      apiUrl: prod.apiUrl,
      token: maskToken(prod.token),
      refreshToken: maskToken(prod.refreshToken),
      mcuToken: maskToken(prod.mcuToken),
      queryPath: prod.queryPath,
      sendPath: prod.sendPath,
      nip: prod.nip,
      invoicePdfPath: prod.invoicePdfPath,
    },
    test: {
      apiUrl: test.apiUrl,
      token: maskToken(test.token),
      refreshToken: maskToken(test.refreshToken),
      mcuToken: maskToken(test.mcuToken),
      queryPath: test.queryPath,
      sendPath: test.sendPath,
      nip: test.nip,
      invoicePdfPath: test.invoicePdfPath,
    },
    // Zachowanie wsteczne: zwróć też płaskie pole dla aktywnego env (stare klienty)
    apiUrl: activeEnv === "test" ? test.apiUrl : prod.apiUrl,
    token: maskToken(activeEnv === "test" ? test.token : prod.token),
    refreshToken: maskToken(activeEnv === "test" ? test.refreshToken : prod.refreshToken),
    queryPath: activeEnv === "test" ? test.queryPath : prod.queryPath,
    sendPath: activeEnv === "test" ? test.sendPath : prod.sendPath,
    nip: activeEnv === "test" ? test.nip : prod.nip,
    invoicePdfPath: activeEnv === "test" ? test.invoicePdfPath : prod.invoicePdfPath,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (body.activeEnv === "test" || body.activeEnv === "prod") {
    await setKsefActiveEnv(body.activeEnv);
  }

  for (const env of ["prod", "test"] as KsefEnv[]) {
    const data = body[env];
    if (data && typeof data === "object") {
      const toSet: Record<string, string> = {};
      const keys = [
        "apiUrl",
        "token",
        "refreshToken",
        "mcuToken",
        "queryPath",
        "sendPath",
        "nip",
        "invoicePdfPath",
      ] as const;
      for (const k of keys) {
        const v = data[k];
        if (v !== undefined) {
          if ((k === "token" || k === "refreshToken" || k === "mcuToken") && (v === "" || v === "********")) continue;
          toSet[k] = String(v ?? "");
        }
      }
      if (Object.keys(toSet).length > 0) {
        await setKsefSettings(env, toSet);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
