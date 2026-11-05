<?php
declare(strict_types=1);
require __DIR__ . '/includes/bootstrap.php';

header('Location: ' . app_url(isset($_SESSION['user_id']) ? 'dashboard.php' : 'login.php'));
exit;
