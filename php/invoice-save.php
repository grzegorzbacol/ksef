<?php
require_once __DIR__ . '/config.php';
require_login();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ' . BASE_PATH . 'invoices.php');
    exit;
}
$number = trim((string) ($_POST['number'] ?? ''));
$issueDate = (string) ($_POST['issue_date'] ?? '');
$saleDate = trim((string) ($_POST['sale_date'] ?? ''));
$sellerName = trim((string) ($_POST['seller_name'] ?? ''));
$sellerNip = trim((string) ($_POST['seller_nip'] ?? ''));
$buyerName = trim((string) ($_POST['buyer_name'] ?? ''));
$buyerNip = trim((string) ($_POST['buyer_nip'] ?? ''));
$netAmount = (float) ($_POST['net_amount'] ?? 0);
$vatAmount = (float) ($_POST['vat_amount'] ?? 0);
$grossAmount = (float) ($_POST['gross_amount'] ?? $netAmount + $vatAmount);
$currency = trim((string) ($_POST['currency'] ?? 'PLN')) ?: 'PLN';

if ($number === '' || $issueDate === '' || $sellerName === '' || $sellerNip === '' || $buyerName === '' || $buyerNip === '') {
    $_SESSION['invoice_error'] = 'Wypełnij wymagane pola.';
    header('Location: ' . BASE_PATH . 'invoices.php');
    exit;
}

$stmt = db()->prepare('INSERT INTO invoices (number, issue_date, sale_date, seller_name, seller_nip, buyer_name, buyer_nip, net_amount, vat_amount, gross_amount, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
try {
    $stmt->execute([
        $number,
        $issueDate,
        $saleDate !== '' ? $saleDate : null,
        $sellerName,
        $sellerNip,
        $buyerName,
        $buyerNip,
        $netAmount,
        $vatAmount,
        $grossAmount,
        $currency,
    ]);
} catch (PDOException $e) {
    if ($e->getCode() == 23000) {
        $_SESSION['invoice_error'] = 'Faktura o tym numerze już istnieje.';
    } else {
        $_SESSION['invoice_error'] = 'Błąd zapisu.';
    }
    header('Location: ' . BASE_PATH . 'invoices.php');
    exit;
}
header('Location: ' . BASE_PATH . 'invoices.php');
exit;
