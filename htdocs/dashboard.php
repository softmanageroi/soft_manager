<?php
declare(strict_types=1);
require __DIR__ . '/includes/bootstrap.php';
app_require_auth();

try {
    $items = app_items();
    $orders = app_data('ims_purchase_orders');
    $receipts = app_data('ims_mrn');
    $issues = app_data('materialRequisitionVouchers');
} catch (Throwable $error) {
    app_handle_error($error, 'Could not load PHP dashboard data');
}

$activePage = 'dashboard';
$pageTitle = 'Dashboard';
require __DIR__ . '/includes/header.php';
?>
<section class="page-heading">
    <div><p class="eyebrow">OVERVIEW</p><h1>Dashboard</h1><p class="muted">A clear view of your purchase and warehouse operations.</p></div>
    <a class="button button-primary" href="<?= app_h(app_url('modules/products.php')) ?>">Manage products</a>
</section>
<section class="metric-grid" aria-label="Operations summary">
    <article class="metric-card"><span>Products</span><strong><?= count($items) ?></strong><a href="<?= app_h(app_url('modules/products.php')) ?>">View products →</a></article>
    <article class="metric-card"><span>Purchase orders</span><strong><?= count($orders) ?></strong><a href="<?= app_h(app_url('modules/purchase.php')) ?>">View purchases →</a></article>
    <article class="metric-card"><span>Material receipts</span><strong><?= count($receipts) ?></strong><a href="<?= app_h(app_url('modules/material-receive.php')) ?>">View receipts →</a></article>
    <article class="metric-card"><span>Material issues</span><strong><?= count($issues) ?></strong><a href="<?= app_h(app_url('modules/material-issue.php')) ?>">View issues →</a></article>
</section>
<section class="panel">
    <div class="panel-heading"><div><h2>Quick actions</h2><p class="muted">Open a module to manage warehouse activity.</p></div></div>
    <div class="quick-links">
        <a href="<?= app_h(app_url('modules/products.php')) ?>">Products</a>
        <a href="<?= app_h(app_url('modules/purchase.php')) ?>">Purchase</a>
        <a href="<?= app_h(app_url('modules/material-receive.php')) ?>">Receive material</a>
        <a href="<?= app_h(app_url('modules/material-issue.php')) ?>">Issue material</a>
        <a href="<?= app_h(app_url('modules/stock.php')) ?>">Current stock</a>
        <a href="<?= app_h(app_url('modules/stock-ledger.php')) ?>">Stock ledger</a>
    </div>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
