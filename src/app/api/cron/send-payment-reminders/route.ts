import { NextRequest, NextResponse } from "next/server";
import { sendPaymentReminderEmails } from "@/lib/send-payment-reminder";

/**
 * Cron: wysyła e-mail z przypomnieniem o rozrachunkach z terminem płatności = dziś.
 * Wywołuj raz dziennie (np. o 8:00) przez Vercel Cron lub zewnętrzny cron z Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await sendPaymentReminderEmails();
    if (result.error) {
      return NextResponse.json(
        { ok: false, sent: result.sent, error: result.error },
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: true, sent: result.sent });
  } catch (err) {
    console.error("cron send-payment-reminders:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Błąd serwera" },
      { status: 500 }
    );
  }
}
