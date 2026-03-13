import { getSession } from "@/lib/auth";
import { runTest } from "@/lib/tesla-scanner";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTest();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: (e instanceof Error ? e.message : String(e)) },
      { status: 500 }
    );
  }
}
