import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSession, verifyPassword, isFirstLogin } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const login = String(body.login ?? "").trim();
  const password = String(body.password ?? "");

  if (!login) {
    return NextResponse.json({ error: "Podaj login." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { login } });
  if (!user) {
    return NextResponse.json({ error: "Nieprawidłowy login lub hasło." }, { status: 401 });
  }

  const first = await isFirstLogin(login);
  if (first) {
    if (!password) {
      return NextResponse.json({ firstLogin: true, login }, { status: 200 });
    }
    return NextResponse.json(
      { error: "Ustaw hasło w formularzu „Pierwsze logowanie”." },
      { status: 400 }
    );
  }

  if (!password) {
    return NextResponse.json({ error: "Podaj hasło." }, { status: 400 });
  }

  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    return NextResponse.json({ error: "Nieprawidłowy login lub hasło." }, { status: 401 });
  }

  await setSession(user.id);
  return NextResponse.json({ ok: true, login: user.login });
}
