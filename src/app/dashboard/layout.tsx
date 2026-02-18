import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { DashboardNav } from "./DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-56 border-r border-border bg-[var(--bg-elevated)] flex flex-col">
        <div className="p-4 border-b border-border">
          <Link
            href="/dashboard"
            className="text-lg font-semibold text-accent tracking-tight hover:text-[var(--accent-hover)] transition-colors"
          >
            BONEA CRM
          </Link>
        </div>
        <DashboardNav />
        <div className="p-3 border-t border-border">
          <div className="rounded-lg px-3 py-2 text-xs text-muted truncate" title={session.login}>
            {session.login}
          </div>
          <LogoutButton login={session.login} />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 pl-56 min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
          <div className="h-14 flex items-center justify-between px-6">
            <span className="text-sm text-muted">Panel zarządzania</span>
          </div>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}
