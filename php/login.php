<?php
require_once __DIR__ . '/config.php';
if (auth_user()) {
    header('Location: ' . BASE_PATH . 'dashboard.php');
    exit;
}

$error = '';
$firstLogin = false;
$loginValue = 'grzegorzbacol';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $login = trim((string) ($_POST['login'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    $confirm = (string) ($_POST['confirm'] ?? '');

    if ($login === '') {
        $error = 'Podaj login.';
    } else {
        $result = login_attempt($login, $password);
        if (!empty($result['first_login'])) {
            $firstLogin = true;
            $loginValue = $result['login'];
            if ($password !== '' && strlen($password) >= 8 && $password === $confirm) {
                if (login_set_password($result['login'], $password)) {
                    $stmt = db()->prepare('SELECT id FROM users WHERE login = ?');
                    $stmt->execute([$result['login']]);
                    $u = $stmt->fetch();
                    if ($u) {
                        login_session((int) $u['id']);
                        header('Location: ' . BASE_PATH . 'dashboard.php');
                        exit;
                    }
                }
                $error = 'Nie udało się ustawić hasła.';
            } elseif ($password !== '' && strlen($password) < 8) {
                $error = 'Hasło musi mieć co najmniej 8 znaków.';
            } elseif ($password !== '' && $password !== $confirm) {
                $error = 'Hasła się nie zgadzają.';
            }
        } elseif ($result !== null) {
            login_session((int) $result['user_id']);
            header('Location: ' . BASE_PATH . 'dashboard.php');
            exit;
        } else {
            $error = 'Nieprawidłowy login lub hasło.';
        }
    }
}

$pageTitle = 'Logowanie – ' . APP_NAME;
?>
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= htmlspecialchars($pageTitle) ?></title>
    <link rel="stylesheet" href="<?= htmlspecialchars(BASE_PATH) ?>assets/style.css">
</head>
<body class="login-page">
<div class="login-box card">
    <h1><?= htmlspecialchars(APP_NAME) ?></h1>
    <p class="sub">Zaloguj się do systemu</p>
    <form method="post" action="">
        <div class="form-group">
            <label>Login</label>
            <input type="text" name="login" value="<?= htmlspecialchars($loginValue) ?>" required autocomplete="username">
        </div>
        <?php if (!$firstLogin): ?>
        <div class="form-group">
            <label>Hasło</label>
            <input type="password" name="password" autocomplete="current-password">
        </div>
        <?php else: ?>
        <div class="form-group">
            <label>Nowe hasło (min. 8 znaków)</label>
            <input type="password" name="password" required minlength="8" autocomplete="new-password">
        </div>
        <div class="form-group">
            <label>Potwierdź hasło</label>
            <input type="password" name="confirm" required autocomplete="new-password">
        </div>
        <?php endif; ?>
        <?php if ($error): ?><div class="alert alert-error"><?= htmlspecialchars($error) ?></div><?php endif; ?>
        <button type="submit" class="btn btn-primary"><?= $firstLogin ? 'Ustaw hasło i zaloguj' : 'Zaloguj' ?></button>
    </form>
</div>
</body>
</html>
