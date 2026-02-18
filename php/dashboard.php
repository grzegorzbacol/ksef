<?php
require_once __DIR__ . '/config.php';
require_login();
$pageTitle = 'Panel – ' . APP_NAME;
require __DIR__ . '/includes/header.php';
?>
<h1>Panel główny</h1>
<div class="grid grid-2" style="margin-top:1.5rem;">
    <a href="<?= BASE_PATH ?>invoices.php" class="card" style="text-decoration:none;color:inherit;display:block;">
        <strong class="text-success">Faktury</strong>
        <p class="text-muted" style="margin:0.25rem 0 0;">Wystawianie, wysyłka do KSEF, pobieranie z KSEF</p>
    </a>
    <a href="<?= BASE_PATH ?>statistics.php" class="card" style="text-decoration:none;color:inherit;display:block;">
        <strong class="text-success">Statystyki</strong>
        <p class="text-muted" style="margin:0.25rem 0 0;">Podsumowania i grupowanie faktur</p>
    </a>
    <a href="<?= BASE_PATH ?>payments.php" class="card" style="text-decoration:none;color:inherit;display:block;">
        <strong class="text-success">Płatności</strong>
        <p class="text-muted" style="margin:0.25rem 0 0;">Checklist opłaconych faktur z datą</p>
    </a>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
