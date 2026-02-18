import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const SESSION_COOKIE = "ksef_session";
const USER_ID_COOKIE = "ksef_user_id";

export async function getSession(): Promise<{ userId: string; login: string } | null> {
  const c = await cookies();
  const session = c.get(SESSION_COOKIE)?.value;
  const userId = c.get(USER_ID_COOKIE)?.value;
  if (!session || !userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return { userId: user.id, login: user.login };
}

export async function setSession(userId: string) {
  const c = await cookies();
  c.set(SESSION_COOKIE, "1", { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7 });
  c.set(USER_ID_COOKIE, userId, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  c.delete(USER_ID_COOKIE);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function isFirstLogin(login: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { login } });
  if (!user) return false;
  return user.password === "";
}
