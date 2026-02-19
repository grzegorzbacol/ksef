import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMailSettings, setMailSettings } from "@/lib/settings";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const s = await getMailSettings();
  const mailConfigured = !!(s.imapHost?.trim() && s.imapUser?.trim() && s.imapPassword?.trim());
  return NextResponse.json({
    imapHost: s.imapHost,
    imapPort: s.imapPort,
    imapUser: s.imapUser,
    imapPassword: s.imapPassword ? "********" : "",
    mailConfigured,
    imapSecure: s.imapSecure,
    imapFolder: s.imapFolder,
    emailAddress: s.emailAddress,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const s = await getMailSettings();
  const updates = {
    imapHost: body.imapHost ?? s.imapHost,
    imapPort: body.imapPort ?? s.imapPort,
    imapUser: body.imapUser ?? s.imapUser,
    imapPassword: (body.imapPassword && body.imapPassword !== "********") ? body.imapPassword : s.imapPassword,
    imapSecure: body.imapSecure ?? s.imapSecure,
    imapFolder: body.imapFolder ?? s.imapFolder,
    emailAddress: body.emailAddress ?? s.emailAddress,
  };
  await setMailSettings(updates);
  return NextResponse.json({ ok: true });
}
