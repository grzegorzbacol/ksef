# BONEA ERP (PHP, seohost.pl)

Wersja w **PHP + MySQL** pod hosting współdzielony (np. **seohost.pl**).

## Wymagania

- PHP 7.4+ (na seohost.pl: do 8.4)
- MySQL 5.7+ (baza w panelu)
- Rozszerzenia PHP: PDO, pdo_mysql, session, json

## Instalacja na seohost.pl

### 1. Utwórz bazę MySQL w panelu

- Zaloguj się do panelu seohost.pl.
- **Bazy danych** → Dodaj bazę MySQL.
- Zapisz: **nazwa bazy**, **użytkownik**, **hasło**, **host** (zazwyczaj `localhost`).

### 2. Import schematu

- W panelu: **phpMyAdmin** (lub narzędzie do MySQL).
- Wybierz swoją bazę.
- Zaimportuj plik **`sql/schema.sql`** (Import → wybierz plik → Wykonaj).

To utworzy tabele `users`, `invoices`, `payments` oraz użytkownika `grzegorzbacol` z pustym hasłem (ustawiane przy pierwszym logowaniu).

### 3. Wgraj pliki

- Przez **FTP** lub **Menadżer plików** wgraj całą zawartość folderu **`php/`** do katalogu strony (np. `public_html` lub `public_html/ksef`).

Struktura na serwerze:

```
public_html/          (lub public_html/ksef/)
  index.php
  login.php
  logout.php
  dashboard.php
  invoices.php
  invoice-save.php
  invoice-view.php
  invoice-ksef.php
  ksef-fetch.php
  ksef.php
  statistics.php
  payments.php
  payment-toggle.php
  config.php
  config.example.php
  db.php
  auth.php
  .htaccess
  assets/
    style.css
  includes/
    header.php
    footer.php
  sql/
    schema.sql
```

### 4. Konfiguracja bazy

- Skopiuj **`config.example.php`** jako **`config.local.php`**.
- Edytuj `config.local.php` i ustaw dane z panelu:

```php
<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'twoja_nazwa_bazy');
define('DB_USER', 'twoj_uzytkownik');
define('DB_PASS', 'twoje_haslo');
// Jeśli aplikacja w podkatalogu, np. /ksef/:
define('BASE_PATH', '/ksef/');
```

Zapisz plik. Dzięki `.htaccess` `config.local.php` nie będzie dostępny z przeglądarki.

### 5. Pierwsze logowanie

- Wejdź na adres strony (np. `https://twoja-domena.pl/` lub `https://twoja-domena.pl/ksef/`).
- Zostaniesz przekierowany na logowanie.
- **Login:** `grzegorzbacol`
- Przy pierwszym wejściu ustaw **hasło** (min. 8 znaków) i potwierdź – od razu się zalogujesz.

## Funkcje

- **Logowanie** – użytkownik `grzegorzbacol`, hasło przy pierwszym logowaniu.
- **Faktury** – dodawanie, lista, szczegóły, wysyłka do KSEF (placeholder), pobieranie z KSEF (placeholder).
- **Statystyki** – sumy, grupowanie po miesiącach i nabywcach.
- **Płatności** – checklist, zaznaczenie = opłacono z zapisem daty.

## KSEF

Plik **`ksef.php`** zawiera placeholdery. Pełna integracja z KSEF wymaga certyfikatu i API zgodnego z dokumentacją MF.

## Bezpieczeństwo

- Hasła: `password_hash()` / `password_verify()`.
- Zapytania: PDO prepared statements.
- `config.local.php` i pliki wewnętrzne są zablokowane w `.htaccess`.
