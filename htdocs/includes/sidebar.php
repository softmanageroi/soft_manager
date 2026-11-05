<aside class="sidebar" data-sidebar>
    <a class="brand" href="<?= app_h(app_url('dashboard.php')) ?>">
        <span class="brand-mark">SM</span>
        <span><strong>Soft Manager</strong><small>Warehouse &amp; Purchase</small></span>
    </a>
    <nav class="nav" aria-label="Main navigation">
        <a class="nav-link <?= $activePage === 'dashboard' ? 'active' : '' ?>" href="<?= app_h(app_url('dashboard.php')) ?>">Dashboard</a>
        <span class="nav-heading">Inventory &amp; Stock</span>
        <a class="nav-link <?= $activePage === 'products' ? 'active' : '' ?>" href="<?= app_h(app_url('modules/products.php')) ?>">Products</a>
        <a class="nav-link <?= $activePage === 'stock' ? 'active' : '' ?>" href="<?= app_h(app_url('modules/stock.php')) ?>">Stock</a>
        <a class="nav-link <?= $activePage === 'ledger' ? 'active' : '' ?>" href="<?= app_h(app_url('modules/stock-ledger.php')) ?>">Stock Ledger</a>
        <span class="nav-heading">Operations</span>
        <a class="nav-link <?= $activePage === 'purchase' ? 'active' : '' ?>" href="<?= app_h(app_url('modules/purchase.php')) ?>">Purchase</a>
        <a class="nav-link <?= $activePage === 'receive' ? 'active' : '' ?>" href="<?= app_h(app_url('modules/material-receive.php')) ?>">Material Receive</a>
        <a class="nav-link <?= $activePage === 'issue' ? 'active' : '' ?>" href="<?= app_h(app_url('modules/material-issue.php')) ?>">Material Issue</a>
    </nav>
</aside>
