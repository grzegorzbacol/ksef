<?php
require_once __DIR__ . '/config.php';
require_login();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ' . BASE_PATH . 'invoices.php');
    exit;
}
$dateFrom = (string) ($_POST['date_from'] ?? date('Y-m-d', strtotime('-30 days')));
$dateTo = (string) ($_POST['date_to'] ?? date('Y-m-d'));
require_once __DIR__ . '/ksef.php';
$result = ksef_fetch($dateFrom, $dateTo);
if ($result['success'] && !empty($result['invoices'])) {
    $ins = db()->prepare('INSERT INTO invoices (number, issue_date, seller_name, seller_nip, buyer_name, buyer_nip, net_amount, vat_amount, gross_amount, source, ksef_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE number = number');
    foreach ($result['invoices'] as $inv) {
        $num = $inv['number'] ?? '';
        if ($num === '') continue;
        $ins->execute([
            $num,
            $inv['issue_date'] ?? date('Y-m-d'),
            $inv['seller_name'] ?? '',
            $inv['seller_nip'] ?? '',
            $inv['buyer_name'] ?? '',
            $inv['buyer_nip'] ?? '',
            (float) ($inv['net_amount'] ?? 0),
            (float) ($inv['vat_amount'] ?? 0),
            (float) ($inv['gross_amount'] ?? 0),
            'ksef',
            'received',
        ]);
    }
}
header('Location: ' . BASE_PATH . 'invoices.php');
exit;
