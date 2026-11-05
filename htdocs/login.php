<?php
declare(strict_types=1);
require __DIR__ . '/includes/bootstrap.php';

if (isset($_SESSION['user_id'])) {
    header('Location: ' . app_url('dashboard.php'));
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    app_verify_csrf();
    $username = trim((string) ($_POST['username'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    if ($username === '' || $password === '') {
        $error = 'Enter your username and password.';
    } else {
        try {
            $statement = app_database()->prepare('SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1');
            $statement->execute([$username]);
            $user = $statement->fetch();
            if ($user && password_verify($password, (string) $user['password_hash'])) {
                session_regenerate_id(true);
                $_SESSION['user_id'] = (int) $user['id'];
                $_SESSION['username'] = (string) $user['username'];
                $_SESSION['expires_at'] = time() + 28800;
                unset($_SESSION['csrf_token']);
                header('Location: ' . app_url('dashboard.php'));
                exit;
            }
            $error = 'Incorrect username or password.';
        } catch (Throwable $exception) {
            error_log('PHP login failed: ' . $exception->getMessage());
            $error = 'Could not connect to the database. Check your MySQL settings and run db/schema.sql.';
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#11172d">
    <title>Login | Soft Manager</title>
    <link rel="stylesheet" href="<?= app_h(app_url('css/style.css')) ?>">
</head>
<body class="auth-page">
    <main class="auth-card">
        <p class="eyebrow">Warehouse &amp; Purchase</p>
        <h1>Welcome back</h1>
        <p class="muted">Sign in with the account created in your Soft Manager MySQL database.</p>
        <?php if ($error !== ''): ?>
            <p class="notice notice-error" role="alert"><?= app_h($error) ?></p>
        <?php endif; ?>
        <form method="post" class="form-stack">
            <input type="hidden" name="csrf_token" value="<?= app_h(app_csrf_token()) ?>">
            <label>Username
                <input name="username" type="text" autocomplete="username" required autofocus>
            </label>
            <label>Password
                <input name="password" type="password" autocomplete="current-password" required>
            </label>
            <button class="button button-primary button-wide" type="submit">Log in</button>
        </form>
    </main>
</body>
</html>
