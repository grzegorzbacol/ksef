"use client";

import { useState } from "react";

const MONTH_NAMES = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

const START_YEAR = 2026;

type MonthYearFilterProps = {
  month: number | null;
  year: number | null;
  onChange: (month: number | null, year: number | null) => void;
};

export function MonthYearFilter({ month, year, onChange }: MonthYearFilterProps) {
  const [open, setOpen] = useState(false);
  const [pendingMonth, setPendingMonth] = useState<number | null>(month);
  const [pendingYear, setPendingYear] = useState<number | null>(year);

  const now = new Date();
  const currentYear = now.getFullYear();
  // Lata od 2026 do aktualnego
  const years = Array.from(
    { length: Math.max(0, currentYear - START_YEAR + 1) },
    (_, i) => START_YEAR + i
  ).reverse();

  const label =
    month != null && year != null
      ? `${MONTH_NAMES[month - 1]} ${year}`
      : "Wszystkie miesiące";

  const handleOpen = () => {
    setPendingMonth(month);
    setPendingYear(year);
    setOpen(true);
  };

  const handleApply = () => {
    onChange(pendingMonth, pendingYear);
    setOpen(false);
  };

  const handleClear = () => {
    setPendingMonth(null);
    setPendingYear(null);
    onChange(null, null);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-2 rounded-lg border border-border bg-bg px-4 py-2 text-sm hover:bg-bg/80 focus:outline-none focus:ring-2 focus:ring-accent"
        aria-expanded={open}
      >
        <span className="text-muted">Filtruj wg miesiąca:</span>
        <span className="font-medium">{label}</span>
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Wysuwane menu */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm border-l border-border bg-card shadow-xl transition-transform duration-200 ease-out sm:max-w-xs ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Wybierz miesiąc i rok"
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Filtruj wg miesiąca</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 hover:bg-bg focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Zamknij"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-muted">Rok</label>
              <select
                value={pendingYear ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setPendingYear(val === "" ? null : parseInt(val, 10));
                }}
                className="w-full rounded border border-border bg-bg px-3 py-2 text-sm"
              >
                <option value="">Wszystkie</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-muted">Miesiąc</label>
              <select
                value={pendingMonth ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setPendingMonth(val === "" ? null : parseInt(val, 10));
                }}
                className="w-full rounded border border-border bg-bg px-3 py-2 text-sm"
              >
                <option value="">Wszystkie</option>
                {MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-2 text-xs text-muted">
            Tylko pełne miesiące. Lata od 2026 do aktualnego.
          </p>

          <div className="mt-auto flex flex-col gap-2 pt-6">
            <button
              type="button"
              onClick={handleApply}
              className="w-full rounded-lg bg-accent px-4 py-2 text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Zastosuj
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="w-full rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Wyczyść filtr
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
