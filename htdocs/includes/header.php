<?php
declare(strict_types=1);
$activePage = $activePage ?? '';
$pageTitle = $pageTitle ?? 'Soft Manager';
$flash = app_take_flash();
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#11172d">
    <title><?= app_h($pageTitle) ?> | Soft Manager</title>
    <link rel="stylesheet" href="<?= app_h(app_url('css/style.css')) ?>">
    <link rel="stylesheet" href="<?= app_h(app_url('css/dashboard.css')) ?>">
    <script src="<?= app_h(app_url('js/app.js')) ?>" defer></script>
</head>
<body class="app-page">
<?php require __DIR__ . '/sidebar.php'; ?>
<div class="app-main">
    <header class="topbar">
        <button class="menu-toggle" type="button" aria-label="Toggle navigation" aria-expanded="true" data-menu-toggle>☰</button>
        <div class="topbar-title"><?= app_h($pageTitle) ?></div>
        <div class="topbar-actions">
            <span class="user-label"><?= app_h($_SESSION['username'] ?? 'User') ?></span>
            <form method="post" action="<?= app_h(app_url('logout.php')) ?>">
                <input type="hidden" name="csrf_token" value="<?= app_h(app_csrf_token()) ?>">
                <button class="button button-quiet" type="submit">Log out</button>
            </form>
        </div>
    </header>
    <main class="content">
        <?php if ($flash): ?>
            <p class="notice notice-<?= app_h($flash['kind'] ?? 'success') ?>" role="status"><?= app_h($flash['message'] ?? '') ?></p>
        <?php endif; ?>
