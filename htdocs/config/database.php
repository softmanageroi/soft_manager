<?php
declare(strict_types=1);

function app_env(string $key, ?string $default = null): ?string
{
    $value = getenv($key);
    if ($value !== false) {
        return $value;
    }

    static $fileValues;
    if ($fileValues === null) {
        $fileValues = [];
        $envFiles = [dirname(__DIR__) . '/.env', dirname(__DIR__, 2) . '/.env'];
        foreach ($envFiles as $envFile) {
            if (is_file($envFile) && is_readable($envFile)) {
                foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                    $line = trim($line);
                    if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                        continue;
                    }
                    [$name, $value] = explode('=', $line, 2);
                    $fileValues[trim($name)] = trim(trim($value), "\"'");
                }
                break;
            }
        }
    }

    return $fileValues[$key] ?? $default;
}

function app_database(): PDO
{
    static $connection;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $host = app_env('MYSQL_HOST', app_env('MYSQLHOST', '127.0.0.1'));
    $port = app_env('MYSQL_PORT', app_env('MYSQLPORT', '3306'));
    $database = app_env('MYSQL_DATABASE', app_env('MYSQLDATABASE', 'soft_manager'));
    $username = app_env('MYSQL_USER', app_env('MYSQLUSER', 'root'));
    $password = app_env('MYSQL_PASSWORD', app_env('MYSQLPASSWORD', ''));

    if ($host === '' || $database === '' || $username === '') {
        throw new RuntimeException('MySQL settings are incomplete. Configure MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, and MYSQL_PASSWORD.');
    }

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $database);
    $connection = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $connection;
}
