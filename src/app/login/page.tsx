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

  const inputClass =
    "w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-text placeholder:text-muted focus:border-border-focus transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-[400px] rounded-2xl border border-border bg-card p-8 shadow-card-lg">
        <h1 className="text-2xl font-semibold text-center tracking-tight mb-1">
          KSEF – Faktury
        </h1>
        <p className="text-muted text-center text-sm mb-8">Zaloguj się do systemu</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Login
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className={inputClass}
              required
              autoComplete="username"
            />
          </div>

          {!firstLogin && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Hasło
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                autoComplete="current-password"
              />
            </div>
          )}

          {firstLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Nowe hasło (min. 8 znaków)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Potwierdź hasło
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                  required
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-danger rounded-lg bg-[var(--danger)]/10 px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-3 font-medium text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {firstLogin ? "Ustaw hasło i zaloguj" : "Zaloguj"}
          </button>
        </form>
      </div>
    </div>
  );
}
