<?php
/** Połączenie PDO MySQL */
$GLOBALS['pdo'] = null;

function db(): PDO {
    if ($GLOBALS['pdo'] === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $GLOBALS['pdo'] = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $GLOBALS['pdo'];
}
