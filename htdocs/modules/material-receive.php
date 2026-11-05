<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
app_require_auth();

$error = '';
try {
    $items = app_items();
    $receipts = app_data('ims_mrn');
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        app_verify_csrf();
        $code = trim((string) ($_POST['item_code'] ?? ''));
        $quantity = app_parse_quantity((string) ($_POST['quantity'] ?? ''));
        $itemIndex = null;
        foreach ($items as $index => $candidate) {
            if (strcasecmp((string) ($candidate['code'] ?? ''), $code) === 0) {
                $itemIndex = $index;
                break;
            }
        }
        if ($itemIndex === null || $quantity === null || $quantity <= 0) {
            throw new InvalidArgumentException('Choose a product and enter a positive received quantity.');
        }
        $date = app_date((string) ($_POST['date'] ?? date('Y-m-d')));
        $warehouse = trim((string) ($_POST['warehouse'] ?? '')) ?: 'Umbrella Facility Management Services Pvt Ltd';
        $poNumber = trim((string) ($_POST['po_no'] ?? ''));
        $item = $items[$itemIndex];
        $items[$itemIndex]['stock'] = (float) ($item['stock'] ?? 0) + $quantity;
        $receipts[] = [
            'id' => 'php-' . bin2hex(random_bytes(8)),
            'no' => 'MRN/' . date('y', strtotime($date) ?: time()) . '/' . str_pad((string) (count($receipts) + 1), 5, '0', STR_PAD_LEFT),
            'date' => $date,
            'poNo' => $poNumber,
            'supplier' => trim((string) ($_POST['supplier'] ?? '')),
            'warehouse' => $warehouse,
            'status' => 'Received',
            'lines' => [[
                'code' => $code,
                'name' => (string) ($item['name'] ?? $code),
                'unit' => (string) ($item['unit'] ?? 'Nos'),
                'qty' => $quantity,
                'receivedQty' => $quantity,
            ]],
        ];
        app_transaction(static function () use ($items, $receipts): void {
            app_save_items($items);
            app_save_data('ims_mrn', $receipts);
        });
        app_flash('Material receipt saved and stock updated.');
        header('Location: ' . app_url('modules/material-receive.php'));
        exit;
    }
} catch (InvalidArgumentException $exception) {
    $error = $exception->getMessage();
} catch (Throwable $exception) {
    app_handle_error($exception, 'Could not load or save PHP material receipt');
}

$activePage = 'receive';
$pageTitle = 'Material Receive';
require __DIR__ . '/../includes/header.php';
?>
<section class="page-heading"><div><p class="eyebrow">OPERATIONS</p><h1>Material receive</h1><p class="muted">Record received quantities and update Item Master stock.</p></div></section>
<?php if ($error !== ''): ?><p class="notice notice-error" role="alert"><?= app_h($error) ?></p><?php endif; ?>
<section class="panel">
    <div class="panel-heading"><div><h2>Record receipt</h2><p class="muted">Warehouse defaults to Umbrella Facility Management Services Pvt Ltd.</p></div></div>
    <?php if (!$items): ?><p class="notice">Add a product before recording a receipt.</p><?php else: ?>
    <form method="post" class="form-grid">
        <input type="hidden" name="csrf_token" value="<?= app_h(app_csrf_token()) ?>">
        <label>Product<select name="item_code" required><option value="">Select product</option><?php foreach ($items as $item): ?><option value="<?= app_h($item['code'] ?? '') ?>"><?= app_h(($item['name'] ?? '') . ' (' . ($item['code'] ?? '') . ')') ?></option><?php endforeach; ?></select></label>
        <label>Received quantity<input name="quantity" type="number" min="0.001" step="0.001" required></label>
        <label>Date<input name="date" type="date" value="<?= app_h(date('Y-m-d')) ?>" required></label>
        <label>Supplier<input name="supplier" maxlength="200"></label>
        <label>PO number<input name="po_no" maxlength="64"></label>
        <label>Warehouse<input name="warehouse" value="Umbrella Facility Management Services Pvt Ltd" maxlength="200"></label>
        <div class="form-actions"><button class="button button-primary" type="submit">Save receipt</button></div>
    </form>
    <?php endif; ?>
</section>
<section class="panel">
    <div class="panel-heading"><div><h2>Recent receipts</h2><p class="muted"><?= count($receipts) ?> receipt<?= count($receipts) === 1 ? '' : 's' ?></p></div></div>
    <div class="table-wrap"><table><thead><tr><th>MRN No.</th><th>Date</th><th>Product</th><th>Warehouse</th><th class="numeric">Received</th></tr></thead><tbody>
    <?php foreach (array_reverse($receipts) as $receipt): foreach (($receipt['lines'] ?? []) as $line): ?><tr><td><?= app_h($receipt['no'] ?? '') ?></td><td><?= app_h($receipt['date'] ?? '') ?></td><td><?= app_h($line['name'] ?? $line['code'] ?? '') ?></td><td><?= app_h($receipt['warehouse'] ?? '') ?></td><td class="numeric"><?= app_h($line['receivedQty'] ?? $line['qty'] ?? 0) ?></td></tr><?php endforeach; endforeach; ?>
    <?php if (!$receipts): ?><tr><td class="empty-cell" colspan="5">No receipts recorded.</td></tr><?php endif; ?>
    </tbody></table></div>
</section>
<?php require __DIR__ . '/../includes/footer.php'; ?>
