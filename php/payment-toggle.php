<?php
require_once __DIR__ . '/config.php';
require_login();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ' . BASE_PATH . 'payments.php');
    exit;
}
$invoiceId = (int) ($_POST['invoice_id'] ?? 0);
if ($invoiceId <= 0) {
    header('Location: ' . BASE_PATH . 'payments.php');
    exit;
}
$stmt = db()->prepare('SELECT id FROM payments WHERE invoice_id = ?');
$stmt->execute([$invoiceId]);
$existing = $stmt->fetch();
if ($existing) {
    db()->prepare('DELETE FROM payments WHERE invoice_id = ?')->execute([$invoiceId]);
} else {
    $ins = db()->prepare('INSERT INTO payments (invoice_id, paid_at) VALUES (?, NOW())');
    $ins->execute([$invoiceId]);
}
header('Location: ' . BASE_PATH . 'payments.php');
exit;
