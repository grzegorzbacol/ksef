"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ login }: { login: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:opacity-90"
      style={{ color: "var(--sidebar-text-muted)" }}
    >
      Wyloguj
    </button>
  );
}
