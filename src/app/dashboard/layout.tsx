import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="font-semibold text-accent">
            KSEF Faktury
          </Link>
          <nav className="flex gap-6 text-sm">
            <Link href="/dashboard" className="text-muted hover:text-text">
              Start
            </Link>
            <Link href="/dashboard/invoices" className="text-muted hover:text-text">
              Faktury kosztowe
            </Link>
            <Link href="/dashboard/invoices-sales" className="text-muted hover:text-text">
              Faktury sprzedaży
            </Link>
            <Link href="/dashboard/contractors" className="text-muted hover:text-text">
              Kontrahenci
            </Link>
            <Link href="/dashboard/ksef" className="text-muted hover:text-text">
              KSEF
            </Link>
            <Link href="/dashboard/settings" className="text-muted hover:text-text">
              Ustawienia
            </Link>
            <Link href="/dashboard/warehouse" className="text-muted hover:text-text">
              Magazyn
            </Link>
            <Link href="/dashboard/statistics" className="text-muted hover:text-text">
              Statystyki
            </Link>
            <Link href="/dashboard/payments" className="text-muted hover:text-text">
              Płatności
            </Link>
            <LogoutButton login={session.login} />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
