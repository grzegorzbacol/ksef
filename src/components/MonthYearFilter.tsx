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
  const currentMonth = now.getMonth() + 1;
  const years = Array.from(
    { length: Math.max(1, currentYear - START_YEAR + 1) },
    (_, i) => START_YEAR + i
  ).reverse();

  const m = month ?? currentMonth;
  const y = year ?? currentYear;
  const label =
    month != null && year != null
      ? `${MONTH_NAMES[month - 1]} ${year}`
      : "Wszystkie miesiące";

  const canPrev = y > START_YEAR || (y === START_YEAR && m > 1);
  const canNext = y < currentYear || (y === currentYear && m < currentMonth);

  const handlePrev = () => {
    if (month == null || year == null) {
      onChange(currentMonth, currentYear);
      return;
    }
    if (m === 1) onChange(12, year - 1);
    else onChange(m - 1, year);
  };

  const handleNext = () => {
    if (month == null || year == null) {
      onChange(currentMonth, currentYear);
      return;
    }
    if (m === 12) onChange(1, year + 1);
    else onChange(m + 1, year);
  };

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
    <div className="flex items-center gap-1 rounded-lg border border-border bg-bg px-1 py-1">
      <button
        type="button"
        onClick={handlePrev}
        disabled={!canPrev}
        className="rounded p-2 text-muted hover:bg-border hover:text-text disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label="Poprzedni miesiąc"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={handleOpen}
        className="min-w-[140px] rounded px-3 py-1.5 text-center text-sm font-medium hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={handleNext}
        disabled={!canNext}
        className="rounded p-2 text-muted hover:bg-border hover:text-text disabled:opacity-40 disabled:hover:bg-transparent"
        aria-label="Następny miesiąc"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="fixed right-0 top-0 z-50 h-full w-full max-w-sm border-l border-border bg-card shadow-xl sm:max-w-xs"
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
      )}
    </div>
  );
}
