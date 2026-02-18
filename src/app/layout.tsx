import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BONEA ERP",
  description: "Wystawianie, KSEF, statystyki i rozrachunki",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen bg-bg text-[var(--text)] font-sans antialiased">{children}</body>
    </html>
  );
}
