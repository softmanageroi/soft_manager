<?php
declare(strict_types=1);

function app_base_path(): string
{
    $scriptDirectory = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
    if (str_ends_with($scriptDirectory, '/modules')) {
        $scriptDirectory = dirname($scriptDirectory);
    }
    return $scriptDirectory === '/' || $scriptDirectory === '.' ? '' : rtrim($scriptDirectory, '/');
}

function app_url(string $path = ''): string
{
    return app_base_path() . '/' . ltrim($path, '/');
}

function app_require_auth(): void
{
    if (!isset($_SESSION['user_id'], $_SESSION['username'], $_SESSION['expires_at'])
        || (int) $_SESSION['expires_at'] <= time()) {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_destroy();
        }
        header('Location: ' . app_url('login.php'));
        exit;
    }
}

function app_csrf_token(): string
{
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function app_verify_csrf(): void
{
    $token = $_POST['csrf_token'] ?? '';
    if (!is_string($token) || !hash_equals(app_csrf_token(), $token)) {
        http_response_code(400);
        exit('The form expired. Reload the page and try again.');
    }
}

function app_user_id(): int
{
    app_require_auth();
    return (int) $_SESSION['user_id'];
}

function app_data(string $key, array $fallback = []): array
{
    $statement = app_database()->prepare(
        'SELECT value_text FROM user_app_data WHERE user_id = ? AND storage_key = ? LIMIT 1'
    );
    $statement->execute([app_user_id(), $key]);
    $value = $statement->fetchColumn();
    if ($value === false) {
        return $fallback;
    }

    $decoded = json_decode((string) $value, true);
    if (!is_array($decoded)) {
        throw new UnexpectedValueException(sprintf('Saved application data for "%s" is not a JSON array or object.', $key));
    }
    return $decoded;
}

function app_save_data(string $key, array $value): void
{
    $json = json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $statement = app_database()->prepare(
        'INSERT INTO user_app_data (user_id, storage_key, value_text) VALUES (?, ?, ?) '
        . 'ON DUPLICATE KEY UPDATE value_text = VALUES(value_text)'
    );
    $statement->execute([app_user_id(), $key, $json]);
}

function app_transaction(callable $operation): mixed
{
    $database = app_database();
    $ownsTransaction = !$database->inTransaction();
    if ($ownsTransaction) {
        $database->beginTransaction();
    }

    try {
        $result = $operation();
        if ($ownsTransaction) {
            $database->commit();
        }
        return $result;
    } catch (Throwable $error) {
        if ($ownsTransaction && $database->inTransaction()) {
            $database->rollBack();
        }
        throw $error;
    }
}

function app_date(string $value): string
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    $errors = DateTimeImmutable::getLastErrors();
    if (!$date || ($errors && ($errors['warning_count'] || $errors['error_count']))
        || $date->format('Y-m-d') !== $value) {
        throw new InvalidArgumentException('Enter a valid date.');
    }
    return $value;
}

function app_parse_quantity(string $value): ?float
{
    $number = preg_replace('/[\s\x{00a0}\x{202f}\'`]/u', '', trim($value));
    if (!is_string($number) || $number === '') {
        return null;
    }

    $comma = strrpos($number, ',');
    $dot = strrpos($number, '.');
    if ($comma !== false && $dot !== false) {
        if ($comma > $dot) {
            $number = str_replace('.', '', $number);
            $number = str_replace(',', '.', $number);
        } else {
            $number = str_replace(',', '', $number);
        }
    } elseif ($comma !== false) {
        $number = preg_match('/^[+-]?\d{1,3}(,\d{3})+$/', $number)
            ? str_replace(',', '', $number)
            : str_replace(',', '.', $number);
    } elseif (substr_count($number, '.') > 1) {
        if (!preg_match('/^[+-]?\d{1,3}(\.\d{3})+$/', $number)) {
            return null;
        }
        $number = str_replace('.', '', $number);
    }

    if (!is_numeric($number)) {
        return null;
    }
    $quantity = (float) $number;
    return is_finite($quantity) ? $quantity : null;
}

function app_flash(string $message, string $kind = 'success'): void
{
    $_SESSION['flash'] = ['message' => $message, 'kind' => $kind];
}

function app_take_flash(): ?array
{
    $flash = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return is_array($flash) ? $flash : null;
}

function app_h(mixed $value): string
{
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function app_items(): array
{
    $current = app_data('ims_items');
    $legacy = app_data('softManagerItems');
    $byCode = [];
    foreach (array_merge($legacy, $current) as $item) {
        if (!is_array($item)) {
            continue;
        }
        $code = trim((string) ($item['code'] ?? $item['itemCode'] ?? $item['id'] ?? ''));
        if ($code !== '') {
            $item['code'] = $code;
            $item['name'] = (string) ($item['name'] ?? $item['itemName'] ?? '');
            $item['stock'] = (float) ($item['stock'] ?? 0);
            $byCode[strtolower($code)] = $item;
        }
    }
    return array_values($byCode);
}

function app_save_items(array $items): void
{
    app_transaction(static function () use ($items): void {
        app_save_data('ims_items', $items);
        app_save_data('softManagerItems', $items);
    });
}

function app_next_id(array $records): int
{
    $maximum = 0;
    foreach ($records as $record) {
        if (is_array($record)) {
            $maximum = max($maximum, (int) ($record['id'] ?? 0));
        }
    }
    return $maximum + 1;
}

function app_handle_error(Throwable $error, string $context): void
{
    error_log($context . ': ' . $error->getMessage());
    http_response_code(500);
    $message = 'The request could not be completed. Check the PHP server log and database connection.';
    require __DIR__ . '/error.php';
    exit;
}
