<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
app_require_auth();

$error = '';
try {
    $items = app_items();
    $vouchers = app_data('materialRequisitionVouchers');
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        app_verify_csrf();
        $code = trim((string) ($_POST['item_code'] ?? ''));
        $quantity = app_parse_quantity((string) ($_POST['quantity'] ?? ''));
        $item = null;
        foreach ($items as $candidate) {
            if (strcasecmp((string) ($candidate['code'] ?? ''), $code) === 0) {
                $item = $candidate;
                break;
            }
        }
        if (!$item || $quantity === null || $quantity <= 0) {
            throw new InvalidArgumentException('Choose a product and enter a positive issue quantity.');
        }
        if ($quantity > (float) ($item['stock'] ?? 0)) {
            throw new InvalidArgumentException('Issue quantity cannot exceed the current Item Master stock.');
        }
        $date = app_date((string) ($_POST['date'] ?? date('Y-m-d')));
        $status = ($_POST['status'] ?? '') === 'approved' ? 'approved' : 'pending';
        if ($status === 'approved') {
            foreach ($items as &$entry) {
                if (strcasecmp((string) ($entry['code'] ?? ''), $code) === 0) {
                    $entry['stock'] = (float) ($entry['stock'] ?? 0) - $quantity;
                    break;
                }
            }
            unset($entry);
        }
        $vouchers[] = [
            'id' => 'php-' . bin2hex(random_bytes(8)),
            'docNo' => 'MI/' . date('y', strtotime($date) ?: time()) . '/' . str_pad((string) (count($vouchers) + 1), 5, '0', STR_PAD_LEFT),
            'date' => $date,
            'department' => trim((string) ($_POST['department'] ?? 'General')) ?: 'General',
            'requestedBy' => trim((string) ($_POST['requested_by'] ?? '')),
            'warehouse' => trim((string) ($_POST['warehouse'] ?? '')) ?: 'Umbrella Facility Management Services Pvt Ltd',
            'authorizationStatus' => $status,
            'status' => $status,
            'items' => [[
                'code' => $code,
                'name' => (string) ($item['name'] ?? $code),
                'unit' => (string) ($item['unit'] ?? 'Nos'),
                'quantity' => $quantity,
                'qty' => $quantity,
            ]],
        ];
        app_transaction(static function () use ($items, $vouchers, $status): void {
            if ($status === 'approved') {
                app_save_items($items);
            }
            app_save_data('materialRequisitionVouchers', $vouchers);
        });
        app_flash('Material issue voucher saved.');
        header('Location: ' . app_url('modules/material-issue.php'));
        exit;
    }
} catch (InvalidArgumentException $exception) {
    $error = $exception->getMessage();
} catch (Throwable $exception) {
    app_handle_error($exception, 'Could not load or save PHP material issue');
}

$activePage = 'issue';
$pageTitle = 'Material Issue';
require __DIR__ . '/../includes/header.php';
?>
<section class="page-heading"><div><p class="eyebrow">OPERATIONS</p><h1>Material issue</h1><p class="muted">Create a material issue voucher. Approved issues reduce stock.</p></div></section>
<?php if ($error !== ''): ?><p class="notice notice-error" role="alert"><?= app_h($error) ?></p><?php endif; ?>
<section class="panel">
    <div class="panel-heading"><div><h2>New issue voucher</h2><p class="muted">Pending vouchers do not change stock until approved.</p></div></div>
    <?php if (!$items): ?><p class="notice">Add a product before creating an issue voucher.</p><?php else: ?>
    <form method="post" class="form-grid">
        <input type="hidden" name="csrf_token" value="<?= app_h(app_csrf_token()) ?>">
        <label>Product<select name="item_code" required><option value="">Select product</option><?php foreach ($items as $item): ?><option value="<?= app_h($item['code'] ?? '') ?>"><?= app_h(($item['name'] ?? '') . ' (' . ($item['code'] ?? '') . ')') ?> — <?= app_h($item['stock'] ?? 0) ?> available</option><?php endforeach; ?></select></label>
        <label>Quantity<input name="quantity" type="number" min="0.001" step="0.001" required></label>
        <label>Date<input name="date" type="date" value="<?= app_h(date('Y-m-d')) ?>" required></label>
        <label>Department<input name="department" value="General" maxlength="100"></label>
        <label>Requested by<input name="requested_by" maxlength="150"></label>
        <label>Warehouse<input name="warehouse" value="Umbrella Facility Management Services Pvt Ltd" maxlength="200"></label>
        <label>Status<select name="status"><option value="pending">Pending</option><option value="approved">Approved</option></select></label>
        <div class="form-actions"><button class="button button-primary" type="submit">Save issue</button></div>
    </form>
    <?php endif; ?>
</section>
<section class="panel">
    <div class="panel-heading"><div><h2>Issue register</h2><p class="muted"><?= count($vouchers) ?> voucher<?= count($vouchers) === 1 ? '' : 's' ?></p></div></div>
    <div class="table-wrap"><table><thead><tr><th>Voucher</th><th>Date</th><th>Product</th><th>Department</th><th>Requested by</th><th class="numeric">Quantity</th><th>Status</th></tr></thead><tbody>
    <?php foreach (array_reverse($vouchers) as $voucher): foreach (($voucher['items'] ?? []) as $line): ?><tr><td><?= app_h($voucher['docNo'] ?? '') ?></td><td><?= app_h($voucher['date'] ?? '') ?></td><td><?= app_h($line['name'] ?? $line['code'] ?? '') ?></td><td><?= app_h($voucher['department'] ?? '') ?></td><td><?= app_h($voucher['requestedBy'] ?? '') ?></td><td class="numeric"><?= app_h($line['quantity'] ?? $line['qty'] ?? 0) ?></td><td><span class="status-pill"><?= app_h($voucher['authorizationStatus'] ?? $voucher['status'] ?? '') ?></span></td></tr><?php endforeach; endforeach; ?>
    <?php if (!$vouchers): ?><tr><td class="empty-cell" colspan="7">No issue vouchers recorded.</td></tr><?php endif; ?>
    </tbody></table></div>
</section>
<?php require __DIR__ . '/../includes/footer.php'; ?>
