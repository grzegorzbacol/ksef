# Moduł Budżetu Osobistego (YNAB-style)

Osobny moduł do budżetowania osobistego, w tym **wydatków prywatnych**.

## Funkcje

- **Zero-based budgeting** – każda złotówka przypisana do kategorii
- **Budżety** – użytkownik może mieć wiele budżetów (np. osobisty, rodzinny, firma)
- **Konta** – ON_BUDGET (konto, gotówka, oszczędności) i OFF_BUDGET (lokaty, kredyty)
- **Grupy kategorii** – np. Mieszkanie, Jedzenie, **Wydatki prywatne**
- **Flaga `isPrivateExpenses`** na grupie – do raportów i filtrów
- **Flaga `isPrivate`** na transakcji – wydatek oznaczony jako prywatny
- To Be Budgeted, przydziały miesięczne, rollover
- Raporty: wydatki wg kategorii, wartość netto, przychody vs wydatki

## Struktura

```
modules/personal-budget/
├── lib/           # Serwisy: budgeting, transactions, accounts, reports, rollover, init-budget
├── types.ts       # Typy
├── index.ts
└── README.md
```

## API

- `GET/POST /api/personal-budget` – lista / tworzenie budżetów
- `GET/PATCH/DELETE /api/personal-budget/[id]` – szczegóły budżetu
- `GET /api/personal-budget/[id]/summary?month=&year=` – podsumowanie miesiąca
- `GET/POST /api/personal-budget/[id]/transactions` – transakcje
- `PATCH/DELETE /api/personal-budget/[id]/transactions/[txId]`
- `GET/POST /api/personal-budget/[id]/accounts`
- `GET/POST /api/personal-budget/[id]/payees`
- `GET/POST /api/personal-budget/[id]/allocations`
- `GET /api/personal-budget/[id]/reports/spending?month=&year=&privateOnly=true`
- `GET /api/personal-budget/[id]/reports/net-worth`

## Baza danych

Po zmianach w schemacie uruchom:

```bash
npx prisma db push
# lub
npx prisma migrate dev
```

Potem (opcjonalnie) seed:

```bash
npx prisma db seed
```
