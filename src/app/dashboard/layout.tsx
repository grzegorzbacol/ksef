import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { getKsefActiveEnv } from "@/lib/settings";
import { LogoutButton } from "./LogoutButton";
import { DashboardNav } from "./DashboardNav";
import { DashboardHeader } from "./DashboardHeader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const activeEnv = await getKsefActiveEnv();
  const isDemo = activeEnv === "test";

  return (
    <div className="min-h-screen flex">
      {/* Sidebar – dark Intaxo-style */}
      <aside
        className="fixed left-0 top-0 z-40 h-screen w-56 flex flex-col"
        style={{
          backgroundColor: "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
        }}
      >
        <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: "var(--sidebar-border)" }}>
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: "var(--sidebar-active)" }}
          >
            B
          </div>
          <Link
            href="/dashboard"
            className="text-lg font-semibold tracking-tight transition-colors hover:opacity-90"
            style={{ color: "var(--sidebar-text)" }}
          >
            BONEA ERP
          </Link>
        </div>
        <DashboardNav />
        <div className="p-3 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
          <div
            className="rounded-lg px-3 py-2 text-xs truncate mb-1"
            style={{ color: "var(--sidebar-text-muted)" }}
            title={session.login}
          >
            {session.login}
          </div>
          <LogoutButton login={session.login} />
        </div>
      </aside>

      {/* Main content – light Intaxo-style */}
      <main
        className="flex-1 pl-56 min-h-screen flex flex-col"
        style={{ backgroundColor: "var(--content-bg)" }}
      >
        {isDemo && (
          <div
            className="py-2 px-4 text-center text-sm font-medium text-white"
            style={{ backgroundColor: "#ea580c" }}
            role="status"
          >
            Środowisko KSEF: <strong>demo / test</strong> (api-demo.ksef.mf.gov.pl) – dane nie są produkcyjne
          </div>
        )}
        <DashboardHeader />
        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}
