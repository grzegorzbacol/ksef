"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  FileDown,
  Receipt,
  Users,
  Send,
  Package,
  BarChart3,
  Wallet,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  Car,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "Start",
    icon: Home,
    items: [{ href: "/dashboard", label: "Start", icon: Home }],
  },
  {
    label: "Przychody",
    icon: Plus,
    items: [
      { href: "/dashboard/invoices", label: "Faktury sprzedaży", icon: FileText },
      { href: "/dashboard/invoices-sales", label: "Faktury zakupu", icon: FileDown },
      { href: "/dashboard/tax-benefits", label: "Korzyści podatkowe", icon: Receipt },
      { href: "/dashboard/contractors", label: "Kontrahenci", icon: Users },
    ],
  },
  {
    label: "Koszty",
    icon: Minus,
    items: [],
  },
  {
    label: "KSEF",
    icon: Send,
    items: [{ href: "/dashboard/ksef", label: "KSEF", icon: Send }],
  },
  {
    label: "Magazyn",
    icon: Package,
    items: [{ href: "/dashboard/warehouse", label: "Magazyn", icon: Package }],
  },
  {
    label: "Analizy",
    icon: BarChart3,
    items: [
      { href: "/dashboard/statistics", label: "Statystyki", icon: BarChart3 },
      { href: "/dashboard/rozrachunki", label: "Rozrachunki", icon: Wallet },
    ],
  },
  {
    label: "Tesla Scanner",
    icon: Car,
    items: [{ href: "/dashboard/tesla-scanner", label: "Tesla Scanner", icon: Car }],
  },
  {
    label: "Ustawienia",
    icon: Settings,
    items: [{ href: "/dashboard/settings", label: "Ustawienia", icon: Settings }],
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    if (pathname === item.href) return true;
    if (item.href === "/dashboard") return false;
    const prefix = item.href + "/";
    if (!pathname.startsWith(prefix)) return false;
    if (item.href === "/dashboard/invoices" && pathname.startsWith("/dashboard/invoices-sales")) return false;
    return true;
  }

  return (
    <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
      {navSections.map((section) => {
        if (section.items.length === 0) {
          return (
            <div key={section.label} className="px-4 py-2 flex items-center gap-2 text-sm" style={{ color: "var(--sidebar-text-muted)" }}>
              <section.icon className="w-4 h-4 flex-shrink-0" />
              <span>{section.label}</span>
              <ChevronDown className="w-4 h-4 ml-auto opacity-50" />
            </div>
          );
        }
        const isSectionActive = section.items.some((i) => isActive(i));
        return (
          <div key={section.label} className="space-y-0.5">
            {section.items.length > 1 && (
              <div className="px-4 py-2 flex items-center gap-2 text-sm" style={{ color: "var(--sidebar-text-muted)" }}>
                <section.icon className="w-4 h-4 flex-shrink-0" />
                <span>{section.label}</span>
                <ChevronDown className="w-4 h-4 ml-auto opacity-50" />
              </div>
            )}
            {section.items.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                    active
                      ? "font-medium"
                      : "hover:opacity-90"
                  }`}
                  style={{
                    backgroundColor: active ? "var(--sidebar-active-bg)" : "transparent",
                    color: active ? "var(--sidebar-active)" : "var(--sidebar-text)",
                    borderLeft: active ? "3px solid var(--sidebar-active)" : "3px solid transparent",
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0 [&]:text-inherit" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {section.items.length === 1 && !active && <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
