<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
app_require_auth();

try {
    $items = app_items();
    $receipts = app_data('ims_mrn');
    $vouchers = app_data('materialRequisitionVouchers');
} catch (Throwable $exception) {
    app_handle_error($exception, 'Could not load PHP stock ledger');
}

$rows = [];
foreach ($items as $item) {
    $code = (string) ($item['code'] ?? '');
    $received = 0.0;
    $issued = 0.0;
    foreach ($receipts as $receipt) {
        foreach (($receipt['lines'] ?? []) as $line) {
            if (strcasecmp((string) ($line['code'] ?? $line['itemCode'] ?? ''), $code) === 0) {
                $received += (float) ($line['receivedQty'] ?? $line['qty'] ?? 0);
            }
        }
    }
    foreach ($vouchers as $voucher) {
        if (!in_array(strtolower((string) ($voucher['authorizationStatus'] ?? $voucher['status'] ?? '')), ['approved', 'authorized', 'issued', 'completed'], true)) {
            continue;
        }
        foreach (($voucher['items'] ?? []) as $line) {
            if (strcasecmp((string) ($line['code'] ?? $line['itemCode'] ?? ''), $code) === 0) {
                $issued += (float) ($line['quantity'] ?? $line['qty'] ?? 0);
            }
        }
    }
    $opening = (float) ($item['stock'] ?? 0) - $received + $issued;
    $rows[] = [
        'name' => $item['name'] ?? '',
        'code' => $code,
        'department' => $item['category'] ?? $item['department'] ?? 'Uncategorized',
        'unit' => $item['unit'] ?? 'Nos',
        'opening' => $opening,
        'received' => $received,
        'issued' => $issued,
        'balance' => (float) ($item['stock'] ?? 0),
    ];
}

$query = strtolower(trim((string) ($_GET['q'] ?? '')));
if ($query !== '') {
    $rows = array_values(array_filter($rows, static fn(array $row): bool =>
        str_contains(strtolower((string) $row['name']), $query)
        || str_contains(strtolower((string) $row['code']), $query)
    ));
}
$activePage = 'ledger';
$pageTitle = 'Stock Ledger';
require __DIR__ . '/../includes/header.php';
?>
<section class="page-heading"><div><p class="eyebrow">REPORTS</p><h1>Stock ledger</h1><p class="muted">Opening stock, material receipts, approved issues, and current balance.</p></div></section>
<section class="panel">
    <div class="panel-heading"><div><h2>Item movements</h2><p class="muted"><?= count($rows) ?> item<?= count($rows) === 1 ? '' : 's' ?></p></div>
        <form method="get" class="inline-search"><label class="sr-only" for="ledger-search">Search products</label><input id="ledger-search" type="search" name="q" value="<?= app_h($_GET['q'] ?? '') ?>" placeholder="Search name or code"><button class="button button-secondary" type="submit">Search</button></form>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Code</th><th>Department</th><th class="numeric">Opening</th><th class="numeric">Received</th><th class="numeric">Issued</th><th class="numeric">Balance</th><th>Unit</th></tr></thead><tbody>
    <?php foreach ($rows as $row): ?><tr><td><?= app_h($row['name']) ?></td><td><?= app_h($row['code']) ?></td><td><?= app_h($row['department']) ?></td><td class="numeric"><?= app_h(number_format($row['opening'], 3)) ?></td><td class="numeric"><?= app_h(number_format($row['received'], 3)) ?></td><td class="numeric"><?= app_h(number_format($row['issued'], 3)) ?></td><td class="numeric"><?= app_h(number_format($row['balance'], 3)) ?></td><td><?= app_h($row['unit']) ?></td></tr><?php endforeach; ?>
    <?php if (!$rows): ?><tr><td class="empty-cell" colspan="8">No matching stock records.</td></tr><?php endif; ?>
    </tbody></table></div>
</section>
<?php require __DIR__ . '/../includes/footer.php'; ?>
