<?php
/** Autoryzacja: sesja, pierwsze logowanie, hasło */

function auth_user(): ?array {
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $stmt = db()->prepare('SELECT id, login FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $u = $stmt->fetch();
    return $u ?: null;
}

function require_login(): void {
    if (auth_user() === null) {
        header('Location: ' . BASE_PATH . 'login.php');
        exit;
    }
}

function is_first_login(string $login): bool {
    $stmt = db()->prepare('SELECT password FROM users WHERE login = ?');
    $stmt->execute([$login]);
    $row = $stmt->fetch();
    return $row && $row['password'] === '';
}

function login_set_password(string $login, string $password): bool {
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = db()->prepare('UPDATE users SET password = ? WHERE login = ? AND password = ""');
    return $stmt->execute([$hash, $login]);
}

function login_attempt(string $login, string $password): ?array {
    $stmt = db()->prepare('SELECT id, login, password FROM users WHERE login = ?');
    $stmt->execute([$login]);
    $user = $stmt->fetch();
    if (!$user) {
        return null;
    }
    if ($user['password'] === '') {
        return ['first_login' => true, 'login' => $user['login']];
    }
    if (!password_verify($password, $user['password'])) {
        return null;
    }
    return ['user_id' => $user['id'], 'login' => $user['login']];
}

function login_session(int $userId): void {
    $_SESSION['user_id'] = $userId;
}

function logout(): void {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}
