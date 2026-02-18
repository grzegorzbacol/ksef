<?php
require_once __DIR__ . '/config.php';
require_login();
require_once __DIR__ . '/ksef.php';

$error = '';
if (isset($_SESSION['invoice_error'])) {
    $error = $_SESSION['invoice_error'];
    unset($_SESSION['invoice_error']);
}

$invoices = db()->query('SELECT i.*, p.paid_at AS payment_paid_at FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id ORDER BY i.issue_date DESC')->fetchAll(PDO::FETCH_ASSOC);

$pageTitle = 'Faktury – ' . APP_NAME;
require __DIR__ . '/includes/header.php';
?>
<h1>Faktury</h1>

<div class="card">
    <h2 style="margin-top:0;">Pobierz z KSEF</h2>
    <form method="post" action="<?= BASE_PATH ?>ksef-fetch.php" style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:flex-end;">
        <div class="form-group" style="margin-bottom:0;">
            <label>Od</label>
            <input type="date" name="date_from" value="<?= htmlspecialchars(date('Y-m-d', strtotime('-30 days'))) ?>">
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label>Do</label>
            <input type="date" name="date_to" value="<?= htmlspecialchars(date('Y-m-d')) ?>">
        </div>
        <button type="submit" class="btn btn-secondary">Pobierz z KSEF</button>
    </form>
</div>

<div class="card">
    <h2 style="margin-top:0;">Nowa faktura</h2>
    <?php if ($error): ?><div class="alert alert-error"><?= htmlspecialchars($error) ?></div><?php endif; ?>
    <form method="post" action="<?= BASE_PATH ?>invoice-save.php">
        <div class="grid grid-2">
            <div class="form-group">
                <label>Numer *</label>
                <input type="text" name="number" required>
            </div>
            <div class="form-group">
                <label>Data wystawienia *</label>
                <input type="date" name="issue_date" value="<?= htmlspecialchars(date('Y-m-d')) ?>" required>
            </div>
            <div class="form-group">
                <label>Data sprzedaży</label>
                <input type="date" name="sale_date">
            </div>
            <div class="form-group"></div>
            <div class="form-group">
                <label>Sprzedawca – nazwa *</label>
                <input type="text" name="seller_name" required>
            </div>
            <div class="form-group">
                <label>Sprzedawca – NIP *</label>
                <input type="text" name="seller_nip" required>
            </div>
            <div class="form-group">
                <label>Nabywca – nazwa *</label>
                <input type="text" name="buyer_name" required>
            </div>
            <div class="form-group">
                <label>Nabywca – NIP *</label>
                <input type="text" name="buyer_nip" required>
            </div>
            <div class="form-group">
                <label>Netto</label>
                <input type="number" step="0.01" name="net_amount" value="0">
            </div>
            <div class="form-group">
                <label>VAT</label>
                <input type="number" step="0.01" name="vat_amount" value="0">
            </div>
            <div class="form-group">
                <label>Brutto</label>
                <input type="number" step="0.01" name="gross_amount" value="0">
            </div>
            <div class="form-group">
                <label>Waluta</label>
                <input type="text" name="currency" value="PLN">
            </div>
        </div>
        <button type="submit" class="btn btn-primary">Zapisz fakturę</button>
    </form>
</div>

<h2>Lista faktur</h2>
<?php if (empty($invoices)): ?>
<p class="text-muted">Brak faktur. Dodaj pierwszą lub pobierz z KSEF.</p>
<?php else: ?>
<div class="table-wrap">
    <table>
        <thead>
            <tr>
                <th>Numer</th>
                <th>Data</th>
                <th>Nabywca</th>
                <th class="text-right">Brutto</th>
                <th>KSEF</th>
                <th>Opłacono</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($invoices as $inv): ?>
            <tr>
                <td><strong><?= htmlspecialchars($inv['number']) ?></strong></td>
                <td><?= htmlspecialchars(date('d.m.Y', strtotime($inv['issue_date']))) ?></td>
                <td><?= htmlspecialchars($inv['buyer_name']) ?></td>
                <td class="text-right"><?= number_format($inv['gross_amount'], 2, ',', ' ') ?> <?= htmlspecialchars($inv['currency']) ?></td>
                <td>
                    <?php if (!empty($inv['ksef_sent_at'])): ?>
                        <span class="text-success">Wysłano</span>
                    <?php else: ?>
                        <form method="post" action="<?= BASE_PATH ?>invoice-ksef.php" style="display:inline;">
                            <input type="hidden" name="id" value="<?= (int)$inv['id'] ?>">
                            <button type="submit" class="btn btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.85rem;">Wyślij do KSEF</button>
                        </form>
                    <?php endif; ?>
                </td>
                <td>
                    <?php if (!empty($inv['payment_paid_at'])): ?>
                        <span class="text-success">Tak (<?= date('d.m.Y', strtotime($inv['payment_paid_at'])) ?>)</span>
                    <?php else: ?>
                        <a href="<?= BASE_PATH ?>payments.php">Nie</a>
                    <?php endif; ?>
                </td>
                <td><a href="<?= BASE_PATH ?>invoice-view.php?id=<?= (int)$inv['id'] ?>">Szczegóły</a></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>
<?php require __DIR__ . '/includes/footer.php'; ?>
