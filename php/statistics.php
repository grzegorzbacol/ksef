<?php
require_once __DIR__ . '/config.php';
require_login();

$groupBy = (string) ($_GET['group'] ?? '');

$rows = db()->query('SELECT i.*, p.paid_at AS payment_paid_at FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id')->fetchAll(PDO::FETCH_ASSOC);
$totalGross = array_sum(array_column($rows, 'gross_amount'));
$totalNet = array_sum(array_column($rows, 'net_amount'));
$totalVat = array_sum(array_column($rows, 'vat_amount'));
$paidRows = array_filter($rows, fn($r) => !empty($r['payment_paid_at']));
$paidGross = array_sum(array_column($paidRows, 'gross_amount'));
$paidCount = count($paidRows);
$unpaidGross = $totalGross - $paidGross;

$byMonth = [];
foreach ($rows as $r) {
    $key = date('Y-m', strtotime($r['issue_date']));
    if (!isset($byMonth[$key])) $byMonth[$key] = ['count' => 0, 'gross' => 0];
    $byMonth[$key]['count']++;
    $byMonth[$key]['gross'] += (float) $r['gross_amount'];
}
krsort($byMonth);
$byMonth = array_slice($byMonth, 0, 12, true);

$byBuyer = [];
foreach ($rows as $r) {
    $key = $r['buyer_nip'] . ' | ' . $r['buyer_name'];
    if (!isset($byBuyer[$key])) $byBuyer[$key] = ['count' => 0, 'gross' => 0];
    $byBuyer[$key]['count']++;
    $byBuyer[$key]['gross'] += (float) $r['gross_amount'];
}

$pageTitle = 'Statystyki – ' . APP_NAME;
require __DIR__ . '/includes/header.php';
?>
<h1>Statystyki</h1>
<div class="grid grid-4" style="margin-bottom:1.5rem;">
    <div class="stat-card">
        <div class="label">Liczba faktur</div>
        <div class="value"><?= count($rows) ?></div>
    </div>
    <div class="stat-card">
        <div class="label">Suma brutto (PLN)</div>
        <div class="value"><?= number_format($totalGross, 2, ',', ' ') ?></div>
    </div>
    <div class="stat-card">
        <div class="label">Opłacone (brutto)</div>
        <div class="value text-success"><?= number_format($paidGross, 2, ',', ' ') ?></div>
        <div class="label"><?= $paidCount ?> faktur</div>
    </div>
    <div class="stat-card">
        <div class="label">Nieopłacone (brutto)</div>
        <div class="value text-warning"><?= number_format($unpaidGross, 2, ',', ' ') ?></div>
    </div>
</div>

<p class="text-muted" style="margin-bottom:0.5rem;">Grupowanie</p>
<p>
    <a href="?group=" class="btn <?= $groupBy === '' ? 'btn-primary' : 'btn-secondary' ?>">Brak</a>
    <a href="?group=month" class="btn <?= $groupBy === 'month' ? 'btn-primary' : 'btn-secondary' ?>">Po miesiącach</a>
    <a href="?group=buyer" class="btn <?= $groupBy === 'buyer' ? 'btn-primary' : 'btn-secondary' ?>">Po nabywcach</a>
</p>

<?php if ($groupBy === 'month' && !empty($byMonth)): ?>
<div class="card">
    <h2 style="margin-top:0;">Według miesięcy</h2>
    <div class="table-wrap">
        <table>
            <thead>
                <tr><th>Miesiąc</th><th class="text-right">Liczba</th><th class="text-right">Brutto</th></tr>
            </thead>
            <tbody>
                <?php foreach ($byMonth as $key => $v): ?>
                <tr>
                    <td><?= htmlspecialchars($key) ?></td>
                    <td class="text-right"><?= $v['count'] ?></td>
                    <td class="text-right"><?= number_format($v['gross'], 2, ',', ' ') ?></td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php endif; ?>

<?php if ($groupBy === 'buyer' && !empty($byBuyer)): ?>
<div class="card">
    <h2 style="margin-top:0;">Według nabywców</h2>
    <?php foreach ($byBuyer as $label => $v): ?>
    <p><strong class="text-success"><?= htmlspecialchars($label) ?></strong><br>
        <span class="text-muted">Faktur: <?= $v['count'] ?></span><br>
        Suma brutto: <?= number_format($v['gross'], 2, ',', ' ') ?> PLN
    </p>
    <?php endforeach; ?>
</div>
<?php endif; ?>
<?php require __DIR__ . '/includes/footer.php'; ?>
