# Kompatybilność z Coolify

## ✅ Status: **Kompatybilne**

Projekt jest gotowy do deploymentu na Coolify. Dockerfile i konfiguracja są już dostosowane.

---

## Konfiguracja w Coolify

### 1. Build Pack
- Ustaw **Build Pack** na `Dockerfile` (projekt używa własnego Dockerfile z Prisma)

### 2. Port
- **Ports Exposes**: `3000`

### 3. Zmienne środowiskowe (Environment)
Ustaw w sekcji Environment:

| Zmienna | Opis | Wymagana |
|---------|------|----------|
| `DATABASE_URL` | PostgreSQL connection string, np. `postgresql://USER:PASSWORD@HOST:5432/ksef?schema=public` | Tak |
| `NEXTAUTH_SECRET` | Losowy secret do sesji (np. `openssl rand -base64 32`) | Tak |
| `KSEF_API_URL` | `https://api.ksef.mf.gov.pl` (prod) lub `https://api-demo.ksef.mf.gov.pl` (demo) | Tak |
| `KSEF_TOKEN` | Token z portalu KSEF | Opcjonalnie (można ustawić w panelu) |
| `CRON_SECRET` | Opcjonalnie – do zabezpieczenia endpointów `/api/cron/*` | Nie |

### 4. Baza danych
- Stwórz usługę PostgreSQL w Coolify (lub użyj zewnętrznej)
- Skopiuj `DATABASE_URL` do zmiennych aplikacji
- Przy pierwszym uruchomieniu: migracja (`prisma db push`) i seed wykonają się automatycznie z CMD

---

## Uwagi

- **Załączniki**: Aplikacja zapisuje treść załączników w bazie (`content` w `InvoiceEmailAttachment`), więc działa bez wolumenu na dysku.
- **Prisma**: Dockerfile wykonuje `prisma generate` przy buildzie oraz `prisma db push` + `prisma db seed` przy starcie kontenera.
- Dla produkcji z migracjami można zamienić `db push` na `migrate deploy` w skrypcie `start:prod`.
