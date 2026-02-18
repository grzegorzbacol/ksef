<?php
require_once __DIR__ . '/config.php';
if (auth_user()) {
    header('Location: ' . BASE_PATH . 'dashboard.php');
} else {
    header('Location: ' . BASE_PATH . 'login.php');
}
exit;
