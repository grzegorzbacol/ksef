"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("grzegorzbacol");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstLogin, setFirstLogin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (firstLogin) {
      if (password.length < 8) {
        setError("Hasło musi mieć co najmniej 8 znaków.");
        setLoading(false);
        return;
      }
      if (password !== confirm) {
        setError("Hasła się nie zgadzają.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password, confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Błąd ustawiania hasła.");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
    const data = await res.json().catch(() => ({}));

    if (data.firstLogin === true) {
      setFirstLogin(true);
      setError("");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      setError(data.error || "Logowanie nie powiodło się.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-xl">
        <h1 className="text-2xl font-semibold text-center mb-2">KSEF – Faktury</h1>
        <p className="text-muted text-center text-sm mb-6">Zaloguj się do systemu</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Login</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text focus:border-accent focus:outline-none"
              required
              autoComplete="username"
            />
          </div>

          {!firstLogin && (
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Hasło</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text focus:border-accent focus:outline-none"
                autoComplete="current-password"
              />
            </div>
          )}

          {firstLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Nowe hasło (min. 8 znaków)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text focus:border-accent focus:outline-none"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Potwierdź hasło</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text focus:border-accent focus:outline-none"
                  required
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {firstLogin ? "Ustaw hasło i zaloguj" : "Zaloguj"}
          </button>
        </form>
      </div>
    </div>
  );
}
