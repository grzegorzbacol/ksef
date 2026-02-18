"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (data?.user) router.replace("/dashboard");
        else router.replace("/login");
      })
      .catch(() => router.replace("/login"));
  }, [mounted, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <p className="text-muted">Ładowanie…</p>
    </div>
  );
}
