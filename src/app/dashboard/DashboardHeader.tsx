"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  Settings,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
} from "lucide-react";

const pathLabels: Record<string, string> = {
  "/dashboard": "Start",
  "/dashboard/invoices": "Faktury sprzedaży",
  "/dashboard/invoices-sales": "Faktury zakupu",
  "/dashboard/tax-benefits": "Korzyści podatkowe",
  "/dashboard/contractors": "Kontrahenci",
  "/dashboard/ksef": "KSEF",
  "/dashboard/warehouse": "Magazyn",
  "/dashboard/statistics": "Statystyki",
  "/dashboard/rozrachunki": "Rozrachunki",
  "/dashboard/settings": "Ustawienia",
};

function getBreadcrumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { href: string; label: string }[] = [{ href: "/dashboard", label: "BONEA ERP" }];
  let acc = "";
  for (const p of parts) {
    acc += `/${p}`;
    const label = pathLabels[acc] ?? p.charAt(0).toUpperCase() + p.slice(1);
    crumbs.push({ href: acc, label });
  }
  return crumbs;
}

export function DashboardHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const breadcrumbs = getBreadcrumbs(pathname);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80" style={{ borderColor: "var(--content-border)" }}>
      <div className="h-14 flex items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            className="flex-shrink-0 w-9 h-9 rounded flex items-center justify-center text-white transition-colors"
            style={{ backgroundColor: "var(--sidebar-active)" }}
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <nav className="flex items-center gap-1.5 text-sm overflow-x-auto">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1.5 flex-shrink-0">
                {i > 0 && <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />}
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-medium" style={{ color: "var(--content-text)" }}>
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="hover:underline"
                    style={{ color: "var(--content-text-secondary)" }}
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Link
            href="/dashboard/settings"
            className="p-2 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: "var(--content-text-secondary)" }}
            title="Ustawienia"
          >
            <Settings className="w-5 h-5" />
          </Link>
          <button
            type="button"
            className="p-2 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: "var(--content-text-secondary)" }}
            title="Pomoc"
            aria-label="Pomoc"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="p-2 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: "var(--content-text-secondary)" }}
            title="Powiadomienia"
            aria-label="Powiadomienia"
          >
            <Bell className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: "var(--content-text-secondary)" }}
            title="Wyloguj"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline text-sm">Wyloguj</span>
          </button>
        </div>
      </div>
    </header>
  );
}
