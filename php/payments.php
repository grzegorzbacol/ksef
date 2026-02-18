<?php
require_once __DIR__ . '/config.php';
require_login();

$invoices = db()->query('
  SELECT i.id, i.number, i.issue_date, i.buyer_name, i.gross_amount, i.currency, p.paid_at AS payment_paid_at
  FROM invoices i
  LEFT JOIN payments p ON p.invoice_id = i.id
  ORDER BY i.issue_date DESC
')->fetchAll(PDO::FETCH_ASSOC);

$paidCount = count(array_filter($invoices, fn($r) => !empty($r['payment_paid_at'])));
$unpaidCount = count($invoices) - $paidCount;

$pageTitle = 'Płatności – ' . APP_NAME;
require __DIR__ . '/includes/header.php';
?>
<h1>Płatności</h1>
<p class="text-muted">Zaznacz checkbox, aby zarejestrować opłacenie faktury (zapisujemy datę kliknięcia).</p>
<p>
    <span class="text-success">Opłacone: <?= $paidCount ?></span>
    &nbsp;|&nbsp;
    <span class="text-warning">Nieopłacone: <?= $unpaidCount ?></span>
</p>
<div class="table-wrap">
    <table>
        <thead>
            <tr>
                <th style="width:3rem;">Opłacono</th>
                <th>Numer</th>
                <th>Data</th>
                <th>Nabywca</th>
                <th class="text-right">Brutto</th>
                <th>Data opłacenia</th>
            </tr>
        </thead>
        <tbody>
            <?php if (empty($invoices)): ?>
            <tr><td colspan="6" class="text-muted" style="text-align:center;padding:2rem;">Brak faktur. Dodaj faktury w module Faktury.</td></tr>
            <?php else: ?>
            <?php foreach ($invoices as $inv): ?>
            <tr>
                <td>
                    <form method="post" action="<?= BASE_PATH ?>payment-toggle.php" style="display:inline;">
                        <input type="hidden" name="invoice_id" value="<?= (int)$inv['id'] ?>">
                        <input type="checkbox" <?= !empty($inv['payment_paid_at']) ? 'checked' : '' ?> onchange="this.form.submit()">
                    </form>
                </td>
                <td><strong><?= htmlspecialchars($inv['number']) ?></strong></td>
                <td><?= date('d.m.Y', strtotime($inv['issue_date'])) ?></td>
                <td><?= htmlspecialchars($inv['buyer_name']) ?></td>
                <td class="text-right"><?= number_format($inv['gross_amount'], 2, ',', ' ') ?> <?= htmlspecialchars($inv['currency']) ?></td>
                <td class="text-muted"><?= $inv['payment_paid_at'] ? date('d.m.Y H:i', strtotime($inv['payment_paid_at'])) : '–' ?></td>
            </tr>
            <?php endforeach; ?>
            <?php endif; ?>
        </tbody>
    </table>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
