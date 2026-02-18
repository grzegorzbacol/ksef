<?php $user = auth_user(); ?>
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= htmlspecialchars($pageTitle ?? APP_NAME) ?></title>
    <link rel="stylesheet" href="<?= htmlspecialchars(BASE_PATH) ?>assets/style.css">
</head>
<body>
<header class="header">
    <div class="container">
        <a href="<?= BASE_PATH ?>dashboard.php" class="logo"><?= htmlspecialchars(APP_NAME) ?></a>
        <nav>
            <a href="<?= BASE_PATH ?>dashboard.php">Start</a>
            <a href="<?= BASE_PATH ?>invoices.php">Faktury</a>
            <a href="<?= BASE_PATH ?>statistics.php">Statystyki</a>
            <a href="<?= BASE_PATH ?>payments.php">Płatności</a>
            <a href="<?= BASE_PATH ?>logout.php">Wyloguj (<?= htmlspecialchars($user['login']) ?>)</a>
        </nav>
    </div>
</header>
<main class="main container">
