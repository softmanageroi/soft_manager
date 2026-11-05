<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Application error | Soft Manager</title>
    <link rel="stylesheet" href="<?= app_h(app_url('css/style.css')) ?>">
</head>
<body class="auth-page">
    <main class="auth-card">
        <p class="eyebrow">Soft Manager</p>
        <h1>Unable to load this page</h1>
        <p role="alert" class="notice notice-error"><?= app_h($message) ?></p>
        <a class="button button-primary" href="<?= app_h(app_url('index.php')) ?>">Return to start</a>
    </main>
</body>
</html>
