<?php
require_once __DIR__ . '/config.php';
logout();
header('Location: ' . BASE_PATH . 'login.php');
exit;
