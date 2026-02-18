import Link from "next/link";

const cards = [
  {
    href: "/dashboard/invoices",
    title: "Faktury kosztowe",
    description: "Wystawianie, wysyłka do KSEF, pobieranie z KSEF",
  },
  {
    href: "/dashboard/invoices-sales",
    title: "Faktury sprzedaży",
    description: "Faktury sprzedaży i zarządzanie nimi",
  },
  {
    href: "/dashboard/statistics",
    title: "Statystyki",
    description: "Podsumowania i grupowanie faktur",
  },
  {
    href: "/dashboard/rozrachunki",
    title: "Rozrachunki",
    description: "Rozliczenia faktur z datą",
  },
];

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Panel główny</h1>
      <p className="text-[var(--text-secondary)] text-sm mb-8">
        Wybierz moduł, aby przejść do zarządzania fakturami, statystykami lub rozrachunkami.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-border bg-card p-6 shadow-card transition-all duration-200 hover:border-border-focus hover:bg-[var(--card-hover)] hover:shadow-card-lg"
          >
            <h2 className="font-medium text-accent mb-1.5 group-hover:text-[var(--accent-hover)] transition-colors">
              {card.title}
            </h2>
            <p className="text-sm text-muted leading-relaxed">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
