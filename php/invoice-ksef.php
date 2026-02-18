<?php
require_once __DIR__ . '/config.php';
require_login();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ' . BASE_PATH . 'invoices.php');
    exit;
}
$id = (int) ($_POST['id'] ?? 0);
if ($id <= 0) {
    header('Location: ' . BASE_PATH . 'invoices.php');
    exit;
}
$stmt = db()->prepare('SELECT * FROM invoices WHERE id = ?');
$stmt->execute([$id]);
$inv = $stmt->fetch();
if (!$inv) {
    header('Location: ' . BASE_PATH . 'invoices.php');
    exit;
}
require_once __DIR__ . '/ksef.php';
$result = ksef_send($inv);
if ($result['success']) {
    $up = db()->prepare('UPDATE invoices SET ksef_sent_at = NOW(), ksef_id = ?, ksef_status = ? WHERE id = ?');
    $up->execute([$result['ksef_id'] ?? null, 'sent', $id]);
}
header('Location: ' . BASE_PATH . 'invoices.php');
exit;
