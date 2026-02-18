import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KSEF – Zarządzanie fakturami",
  description: "Wystawianie, KSEF, statystyki i rozrachunki",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
