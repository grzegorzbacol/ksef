import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getPaymentReminderEmail,
  setPaymentReminderEmail,
  getSmtpSettings,
  setSmtpSettings,
  type SmtpSettings,
} from "@/lib/settings";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [paymentReminderEmail, smtp] = await Promise.all([
    getPaymentReminderEmail(),
    getSmtpSettings(),
  ]);
  return NextResponse.json({
    paymentReminderEmail,
    smtp: {
      ...smtp,
      password: smtp.password ? "********" : "",
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const email = String(body.paymentReminderEmail ?? "").trim();
  if (email) await setPaymentReminderEmail(email);

  if (body.smtp && typeof body.smtp === "object") {
    const s = body.smtp as Partial<SmtpSettings> & { password?: string };
    const current = await getSmtpSettings();
    await setSmtpSettings({
      host: String(s.host ?? current.host).trim(),
      port: String(s.port ?? current.port).trim() || "587",
      user: String(s.user ?? current.user).trim(),
      password: s.password === "********" || s.password === undefined ? current.password : String(s.password ?? ""),
      from: String(s.from ?? current.from).trim(),
      secure: s.secure ?? current.secure,
    });
  }

  return NextResponse.json({ ok: true });
}
