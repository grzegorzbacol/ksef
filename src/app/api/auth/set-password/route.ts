import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, isFirstLogin, setSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const login = String(body.login ?? "").trim();
  const password = String(body.password ?? "");
  const confirm = String(body.confirm ?? "");

  if (!login || !password || password !== confirm) {
    return NextResponse.json(
      { error: "Login i hasło (z potwierdzeniem) są wymagane." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Hasło musi mieć co najmniej 8 znaków." },
      { status: 400 }
    );
  }

  const first = await isFirstLogin(login);
  if (!first) {
    return NextResponse.json({ error: "Hasło zostało już ustawione. Zaloguj się." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { login } });
  if (!user) {
    return NextResponse.json({ error: "Użytkownik nie istnieje." }, { status: 404 });
  }

  const hashed = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  await setSession(user.id);
  return NextResponse.json({ ok: true, login: user.login });
}
