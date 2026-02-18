<?php
require_once __DIR__ . '/config.php';
require_login();
$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    header('Location: ' . BASE_PATH . 'invoices.php');
    exit;
}
$stmt = db()->prepare('SELECT i.*, p.paid_at AS payment_paid_at FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id WHERE i.id = ?');
$stmt->execute([$id]);
$inv = $stmt->fetch();
if (!$inv) {
    header('Location: ' . BASE_PATH . 'invoices.php');
    exit;
}
$pageTitle = 'Faktura ' . htmlspecialchars($inv['number']) . ' – ' . APP_NAME;
require __DIR__ . '/includes/header.php';
?>
<p><a href="<?= BASE_PATH ?>invoices.php">← Lista faktur</a></p>
<div class="card">
    <h1>Faktura <?= htmlspecialchars($inv['number']) ?></h1>
    <dl style="display:grid;grid-template-columns:auto 1fr;gap:0.25rem 1.5rem;">
        <dt class="text-muted">Data wystawienia</dt>
        <dd><?= date('d.m.Y', strtotime($inv['issue_date'])) ?></dd>
        <dt class="text-muted">Data sprzedaży</dt>
        <dd><?= $inv['sale_date'] ? date('d.m.Y', strtotime($inv['sale_date'])) : '–' ?></dd>
        <dt class="text-muted">Sprzedawca</dt>
        <dd><?= htmlspecialchars($inv['seller_name']) ?> (NIP: <?= htmlspecialchars($inv['seller_nip']) ?>)</dd>
        <dt class="text-muted">Nabywca</dt>
        <dd><?= htmlspecialchars($inv['buyer_name']) ?> (NIP: <?= htmlspecialchars($inv['buyer_nip']) ?>)</dd>
        <dt class="text-muted">Netto / VAT / Brutto</dt>
        <dd><?= number_format($inv['net_amount'], 2, ',', ' ') ?> / <?= number_format($inv['vat_amount'], 2, ',', ' ') ?> / <?= number_format($inv['gross_amount'], 2, ',', ' ') ?> <?= htmlspecialchars($inv['currency']) ?></dd>
        <dt class="text-muted">KSEF</dt>
        <dd><?= $inv['ksef_sent_at'] ? 'Wysłano ' . date('d.m.Y H:i', strtotime($inv['ksef_sent_at'])) . ($inv['ksef_id'] ? ' (' . htmlspecialchars($inv['ksef_id']) . ')' : '') : 'Nie wysłano' ?></dd>
        <dt class="text-muted">Źródło</dt>
        <dd><?= $inv['source'] === 'ksef' ? 'Pobrano z KSEF' : 'Wystawiona ręcznie' ?></dd>
        <dt class="text-muted">Opłacono</dt>
        <dd><?= $inv['payment_paid_at'] ? 'Tak – ' . date('d.m.Y H:i', strtotime($inv['payment_paid_at'])) : 'Nie' ?></dd>
    </dl>
    <p><a href="<?= BASE_PATH ?>payments.php" class="btn btn-primary">Moduł płatności</a></p>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
