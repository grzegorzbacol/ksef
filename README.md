# KSEF – Zarządzanie fakturami

Aplikacja do wystawiania faktur, wysyłki i pobierania z KSEF, statystyk oraz rejestracji płatności.

**Stack:** Next.js 14, TypeScript, Prisma, **PostgreSQL**, Docker.

## Funkcje

- **Logowanie** – użytkownik `grzegorzbacol`; hasło ustawiane przy pierwszym logowaniu.
- **Faktury** – wystawianie, wysyłka do KSEF, pobieranie z KSEF (placeholdery w `src/lib/ksef.ts`).
- **Statystyki** – sumy, grupowanie po miesiącach i nabywcach.
- **Płatności** – checklist opłaconych faktur z zapisem daty.

---

## Docker + PostgreSQL (Coolify / dowolny host)

1. **Sklonuj repo** (lub połącz w Coolify z GitHub).
2. **Zbuduj i uruchom:**
   ```bash
   docker build -t ksef-app .
   docker run -d -p 3000:3000 -e DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/NAZWA_BAZY?schema=public" --name ksef ksef-app
   ```
3. W **Coolify:** ustaw w **Environment** zmienną **`DATABASE_URL`** na URL bazy PostgreSQL (z panelu bazy). Build pack: **Docker**.

Przy starcie kontener wykona `prisma db push` i `prisma db seed` (tabele + użytkownik `grzegorzbacol`).

---

## Uruchomienie lokalne

```bash
npm install
# PostgreSQL: ustaw w .env
# DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/ksef?schema=public"
cp .env.example .env   # i uzupełnij DATABASE_URL
npx prisma db push
npx prisma db seed
npm run dev
```

Otwórz http://localhost:3000. Pierwszy ekran to logowanie.

---

## Produkcja (bez Docker)

```bash
npm run build
npm run start:prod
```

Wymagana zmienna **`DATABASE_URL`** (PostgreSQL).

---

## KSEF

W `src/lib/ksef.ts` są placeholdery. Pełna integracja z KSEF wymaga certyfikatu i konfiguracji zgodnej z dokumentacją MF.
