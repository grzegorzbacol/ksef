"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Start" },
  { href: "/dashboard/invoices", label: "Faktury sprzedaży" },
  { href: "/dashboard/invoices-sales", label: "Faktury zakupu" },
  { href: "/dashboard/mail-invoices", label: "Faktury z maila" },
  { href: "/dashboard/contractors", label: "Kontrahenci" },
  { href: "/dashboard/ksef", label: "KSEF" },
  { href: "/dashboard/warehouse", label: "Magazyn" },
  { href: "/dashboard/statistics", label: "Statystyki" },
  { href: "/dashboard/rozrachunki", label: "Rozrachunki" },
  { href: "/dashboard/settings", label: "Ustawienia" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-lg px-3 py-2.5 text-sm transition-colors ${
              isActive
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
