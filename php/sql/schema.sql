-- Baza MySQL dla KSEF – zarządzanie fakturami (seohost.pl)
-- W panelu seohost utwórz bazę i użytkownika, potem zaimportuj ten plik.

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  login VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(64) NOT NULL UNIQUE,
  issue_date DATE NOT NULL,
  sale_date DATE NULL,
  seller_name VARCHAR(255) NOT NULL,
  seller_nip VARCHAR(32) NOT NULL,
  buyer_name VARCHAR(255) NOT NULL,
  buyer_nip VARCHAR(32) NOT NULL,
  net_amount DECIMAL(15,2) NOT NULL,
  vat_amount DECIMAL(15,2) NOT NULL,
  gross_amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'PLN',
  ksef_sent_at DATETIME NULL,
  ksef_id VARCHAR(128) NULL,
  ksef_status VARCHAR(32) NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'manual',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL UNIQUE,
  paid_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Użytkownik do pierwszego logowania (hasło puste = ustaw przy pierwszym wejściu)
INSERT IGNORE INTO users (login, password) VALUES ('grzegorzbacol', '');
