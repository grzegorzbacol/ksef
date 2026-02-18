<?php
/**
 * Konfiguracja – dostosuj do panelu seohost.pl (baza MySQL).
 */
session_start();

define('APP_NAME', 'KSEF – Faktury');

if (file_exists(__DIR__ . '/config.local.php')) {
    require __DIR__ . '/config.local.php';
}
if (!defined('DB_HOST')) define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
if (!defined('DB_NAME')) define('DB_NAME', getenv('DB_NAME') ?: 'ksef_db');
if (!defined('DB_USER')) define('DB_USER', getenv('DB_USER') ?: 'ksef_user');
if (!defined('DB_PASS')) define('DB_PASS', getenv('DB_PASS') ?: '');
if (!defined('DB_CHARSET')) define('DB_CHARSET', 'utf8mb4');
if (!defined('BASE_PATH')) define('BASE_PATH', getenv('BASE_PATH') ?: '');

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
