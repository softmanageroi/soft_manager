<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
app_require_auth();

try {
    $items = app_items();
} catch (Throwable $exception) {
    app_handle_error($exception, 'Could not load PHP stock');
}

$activePage = 'stock';
$pageTitle = 'Stock';
require __DIR__ . '/../includes/header.php';
?>
<section class="page-heading"><div><p class="eyebrow">INVENTORY</p><h1>Current stock</h1><p class="muted">Current item balances from Item Master.</p></div></section>
<section class="metric-grid">
    <article class="metric-card"><span>Products in catalogue</span><strong><?= count($items) ?></strong></article>
    <article class="metric-card"><span>Total stock units</span><strong><?= app_h(number_format(array_sum(array_map(static fn(array $item): float => (float) ($item['stock'] ?? 0), $items)), 3)) ?></strong></article>
    <article class="metric-card"><span>Default warehouse</span><strong class="metric-text">Umbrella Facility Management Services Pvt Ltd</strong></article>
</section>
<section class="panel">
    <div class="panel-heading"><div><h2>Stock by product</h2><p class="muted">Receive or issue stock using the links below.</p></div><div class="quick-links"><a href="<?= app_h(app_url('modules/material-receive.php')) ?>">Receive stock</a><a href="<?= app_h(app_url('modules/material-issue.php')) ?>">Issue stock</a></div></div>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th>Code</th><th>Department</th><th>Unit</th><th class="numeric">Current stock</th></tr></thead><tbody>
    <?php foreach ($items as $item): ?><tr><td><?= app_h($item['name'] ?? '') ?></td><td><?= app_h($item['code'] ?? '') ?></td><td><?= app_h($item['category'] ?? $item['department'] ?? '—') ?></td><td><?= app_h($item['unit'] ?? 'Nos') ?></td><td class="numeric"><?= app_h(number_format((float) ($item['stock'] ?? 0), 3)) ?></td></tr><?php endforeach; ?>
    <?php if (!$items): ?><tr><td class="empty-cell" colspan="5">No products in Item Master.</td></tr><?php endif; ?>
    </tbody></table></div>
</section>
<?php require __DIR__ . '/../includes/footer.php'; ?>
