"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Start" },
  { href: "/dashboard/invoices", label: "Faktury sprzedaży" },
  { href: "/dashboard/invoices-sales", label: "Faktury zakupu" },
  { href: "/dashboard/tax-benefits", label: "Korzyści podatkowe" },
  { href: "/dashboard/contractors", label: "Kontrahenci" },
  { href: "/dashboard/ksef", label: "KSEF" },
  { href: "/dashboard/warehouse", label: "Magazyn" },
  { href: "/dashboard/statistics", label: "Statystyki" },
  { href: "/dashboard/rozrachunki", label: "Rozrachunki" },
  { href: "/dashboard/settings", label: "Ustawienia" },
];

export function DashboardNav() {
  const pathname = usePathname();

  function isActive(item: (typeof navItems)[number]) {
    if (pathname === item.href) return true;
    if (item.href === "/dashboard") return false;
    const prefix = item.href + "/";
    if (!pathname.startsWith(prefix)) return false;
    if (item.href === "/dashboard/invoices" && pathname.startsWith("/dashboard/invoices-sales")) return false;
    return true;
  }

  return (
    <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
      {navItems.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-lg px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-accent-muted text-accent font-medium"
                : "text-[var(--text-secondary)] hover:bg-card hover:text-text"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
