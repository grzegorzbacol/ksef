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
      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-card hover:text-text transition-colors"
    >
      Wyloguj
    </button>
  );
}
