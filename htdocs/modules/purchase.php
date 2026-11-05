<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
app_require_auth();

$error = '';
try {
    $orders = app_data('ims_purchase_orders');
    $items = app_items();
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        app_verify_csrf();
        $supplier = trim((string) ($_POST['supplier'] ?? ''));
        $code = trim((string) ($_POST['item_code'] ?? ''));
        $quantity = app_parse_quantity((string) ($_POST['quantity'] ?? ''));
        $rate = app_parse_quantity((string) ($_POST['rate'] ?? ''));
        $item = null;
        foreach ($items as $candidate) {
            if (strcasecmp((string) ($candidate['code'] ?? ''), $code) === 0) {
                $item = $candidate;
                break;
            }
        }
        if ($supplier === '' || !$item || $quantity === null || $quantity <= 0 || $rate === null || $rate < 0) {
            throw new InvalidArgumentException('Choose a product, supplier, positive quantity, and valid rate.');
        }
        $date = app_date((string) ($_POST['date'] ?? date('Y-m-d')));
        $number = 'PO/' . date('y', strtotime($date) ?: time()) . '/' . str_pad((string) (count($orders) + 1), 5, '0', STR_PAD_LEFT);
        $line = [
            'code' => $code,
            'name' => (string) ($item['name'] ?? $code),
            'unit' => (string) ($item['unit'] ?? 'Nos'),
            'qty' => $quantity,
            'rate' => $rate,
            'amount' => $quantity * $rate,
            'receivedQty' => 0,
            'consumed' => 0,
        ];
        $orders[] = [
            'id' => 'php-' . bin2hex(random_bytes(8)),
            'no' => $number,
            'date' => $date,
            'supplier' => $supplier,
            'total' => $quantity * $rate,
            'status' => 'Draft',
            'authorizationStatus' => 'Pending Authorization',
            'notes' => '',
            'printDetails' => ['warehouse' => trim((string) ($_POST['warehouse'] ?? ''))],
            'lines' => [$line],
        ];
        app_save_data('ims_purchase_orders', $orders);
        app_flash('Purchase order saved.');
        header('Location: ' . app_url('modules/purchase.php'));
        exit;
    }
} catch (InvalidArgumentException $exception) {
    $error = $exception->getMessage();
} catch (Throwable $exception) {
    app_handle_error($exception, 'Could not load or save PHP purchase orders');
}

$activePage = 'purchase';
$pageTitle = 'Purchase';
require __DIR__ . '/../includes/header.php';
?>
<section class="page-heading"><div><p class="eyebrow">OPERATIONS</p><h1>Purchase orders</h1><p class="muted">Create a purchase order using products in Item Master.</p></div></section>
<?php if ($error !== ''): ?><p class="notice notice-error" role="alert"><?= app_h($error) ?></p><?php endif; ?>
<section class="panel">
    <div class="panel-heading"><div><h2>New purchase order</h2><p class="muted">Saved to the existing purchase-order collection.</p></div></div>
    <?php if (!$items): ?><p class="notice">Add a product before creating a purchase order.</p><?php else: ?>
    <form method="post" class="form-grid">
        <input type="hidden" name="csrf_token" value="<?= app_h(app_csrf_token()) ?>">
        <label>Supplier<input name="supplier" required maxlength="200"></label>
        <label>Date<input name="date" type="date" value="<?= app_h(date('Y-m-d')) ?>" required></label>
        <label>Warehouse<input name="warehouse" value="Umbrella Facility Management Services Pvt Ltd" maxlength="200"></label>
        <label>Product<select name="item_code" required><option value="">Select product</option><?php foreach ($items as $item): ?><option value="<?= app_h($item['code'] ?? '') ?>"><?= app_h(($item['name'] ?? '') . ' (' . ($item['code'] ?? '') . ')') ?></option><?php endforeach; ?></select></label>
        <label>Quantity<input name="quantity" type="number" min="0.001" step="0.001" required></label>
        <label>Unit rate<input name="rate" type="number" min="0" step="0.01" value="0" required></label>
        <div class="form-actions"><button class="button button-primary" type="submit">Save purchase order</button></div>
    </form>
    <?php endif; ?>
</section>
<section class="panel">
    <div class="panel-heading"><div><h2>Purchase register</h2><p class="muted"><?= count($orders) ?> order<?= count($orders) === 1 ? '' : 's' ?></p></div></div>
    <div class="table-wrap"><table><thead><tr><th>PO No.</th><th>Date</th><th>Supplier</th><th>Warehouse</th><th class="numeric">Total</th><th>Status</th></tr></thead><tbody>
    <?php foreach (array_reverse($orders) as $order): ?><tr>
        <td><?= app_h($order['no'] ?? '') ?></td><td><?= app_h($order['date'] ?? '') ?></td><td><?= app_h($order['supplier'] ?? '') ?></td>
        <td><?= app_h($order['printDetails']['warehouse'] ?? '') ?></td><td class="numeric"><?= app_h(number_format((float) ($order['total'] ?? 0), 2)) ?></td><td><?= app_h($order['authorizationStatus'] ?? $order['status'] ?? '') ?></td>
    </tr><?php endforeach; ?>
    <?php if (!$orders): ?><tr><td class="empty-cell" colspan="6">No purchase orders saved.</td></tr><?php endif; ?>
    </tbody></table></div>
</section>
<?php require __DIR__ . '/../includes/footer.php'; ?>
