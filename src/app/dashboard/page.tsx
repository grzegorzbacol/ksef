import Link from "next/link";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Panel główny</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/dashboard/invoices"
          className="rounded-xl border border-border bg-card p-6 hover:border-accent transition-colors"
        >
          <h2 className="font-medium text-accent mb-1">Faktury</h2>
          <p className="text-sm text-muted">Wystawianie, wysyłka do KSEF, pobieranie z KSEF</p>
        </Link>
        <Link
          href="/dashboard/statistics"
          className="rounded-xl border border-border bg-card p-6 hover:border-accent transition-colors"
        >
          <h2 className="font-medium text-accent mb-1">Statystyki</h2>
          <p className="text-sm text-muted">Podsumowania i grupowanie faktur</p>
        </Link>
        <Link
          href="/dashboard/payments"
          className="rounded-xl border border-border bg-card p-6 hover:border-accent transition-colors"
        >
          <h2 className="font-medium text-accent mb-1">Płatności</h2>
          <p className="text-sm text-muted">Checklist opłaconych faktur z datą</p>
        </Link>
      </div>
    </div>
  );
}
