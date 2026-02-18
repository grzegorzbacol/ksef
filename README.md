# KSEF – Zarządzanie fakturami

Aplikacja do wystawiania faktur, wysyłki i pobierania z KSEF, statystyk oraz rejestracji płatności.

**Stack:** Next.js 14, TypeScript, Prisma, **PostgreSQL**, Docker.

## Funkcje

- **Logowanie** – użytkownik `grzegorzbacol`; hasło ustawiane przy pierwszym logowaniu.
- **Faktury** – wystawianie, wysyłka do KSEF, pobieranie z KSEF (moduł w `src/lib/ksef.ts`).
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

## KSEF (integracja z Krajowym Systemem e-Faktur)

Moduł łączy się z API KSEF i dodaje faktury z KSEF do bazy. W panelu: **KSEF** (w menu) – status połączenia i przycisk „Pobierz faktury z KSEF” z zakresem dat.

**Zmienne środowiskowe (Coolify / .env):**
- **`KSEF_API_URL`** – adres API (np. `https://api.ksef.mf.gov.pl` lub demo `https://api-demo.ksef.mf.gov.pl`).
- **`KSEF_TOKEN`** – token JWT z portalu KSEF (uwierzytelnianie).

Opcjonalnie: **`KSEF_QUERY_INVOICES_PATH`**, **`KSEF_SEND_INVOICE_PATH`** – gdy ścieżki API różnią się od domyślnych.

Dokumentacja API KSeF 2.0: [ksef.mf.gov.pl](https://ksef.mf.gov.pl), [api-demo.ksef.mf.gov.pl](https://api-demo.ksef.mf.gov.pl).
