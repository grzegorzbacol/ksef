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
    <button type="button" onClick={handleLogout} className="text-muted hover:text-text">
      Wyloguj ({login})
    </button>
  );
}
