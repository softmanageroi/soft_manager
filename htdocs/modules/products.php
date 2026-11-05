<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
app_require_auth();

$message = '';
$error = '';
try {
    $items = app_items();
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        app_verify_csrf();
        $action = (string) ($_POST['action'] ?? '');
        if ($action === 'import') {
            $upload = $_FILES['stock_file'] ?? null;
            if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                throw new InvalidArgumentException('Choose a CSV file and try again.');
            }
            if ((int) ($upload['size'] ?? 0) > 10 * 1024 * 1024) {
                throw new InvalidArgumentException('Choose a CSV file smaller than 10 MB.');
            }
            $extension = strtolower(pathinfo((string) ($upload['name'] ?? ''), PATHINFO_EXTENSION));
            if ($extension !== 'csv' || !is_uploaded_file((string) ($upload['tmp_name'] ?? ''))) {
                throw new InvalidArgumentException('Upload a CSV file. Export Excel workbooks to CSV before importing.');
            }

            $handle = fopen((string) $upload['tmp_name'], 'rb');
            if ($handle === false) {
                throw new RuntimeException('The uploaded CSV file could not be opened.');
            }
            $header = fgetcsv($handle);
            if (!is_array($header)) {
                fclose($handle);
                throw new InvalidArgumentException('The CSV file is empty.');
            }
            $headerMap = [];
            foreach ($header as $index => $value) {
                $normalized = strtolower(preg_replace('/[^a-z0-9]/', '', ltrim(trim((string) $value), "\xEF\xBB\xBF")) ?? '');
                $headerMap[$normalized] = $index;
            }
            $findColumn = static function (array $names) use ($headerMap): ?int {
                foreach ($names as $name) {
                    if (isset($headerMap[$name])) {
                        return $headerMap[$name];
                    }
                }
                return null;
            };
            $codeColumn = $findColumn([
                'itemcode', 'itemcodenumber', 'itemnumber', 'itemno', 'itemnum', 'itemid',
                'materialcode', 'materialnumber', 'materialno', 'sku', 'skucode', 'skuno',
                'productcode', 'productid', 'partcode', 'partnumber', 'partno', 'code',
            ]);
            $quantityColumn = $findColumn([
                'quantity', 'quantitynos', 'qty', 'qtyunits', 'quantityunits', 'stock', 'stockqty',
                'stockquantity', 'currentstock', 'currentqty', 'availableqty', 'availablequantity',
                'balancequantity', 'balanceqty', 'balqty', 'closingstock', 'closingqty',
                'openingstock', 'openingqty', 'openingquantity', 'onhand', 'onhandqty',
                'physicalstock', 'physicalquantity', 'inventoryquantity', 'stockinhand',
            ]);
            $nameColumn = $findColumn(['itemname', 'itemdescription', 'materialname', 'name', 'description']);
            $unitColumn = $findColumn(['unit', 'uom', 'unitofmeasure']);
            $categoryColumn = $findColumn(['department', 'dept', 'category', 'itemcategory']);
            if ($codeColumn === null || $quantityColumn === null) {
                fclose($handle);
                throw new InvalidArgumentException('The CSV needs Item Code and Quantity columns.');
            }

            $imported = [];
            $rowNumber = 1;
            while (($columns = fgetcsv($handle)) !== false) {
                $rowNumber++;
                $code = trim((string) ($columns[$codeColumn] ?? ''));
                $quantityText = trim((string) ($columns[$quantityColumn] ?? ''));
                if ($code === '' && $quantityText === '') {
                    continue;
                }
                $quantity = app_parse_quantity($quantityText);
                if ($code === '' || $quantity === null || $quantity < 0) {
                    fclose($handle);
                    throw new InvalidArgumentException(sprintf('CSV row %d needs an item code and a non-negative quantity.', $rowNumber));
                }
                $key = strtolower($code);
                $record = $imported[$key] ?? [
                    'code' => $code,
                    'name' => '',
                    'unit' => '',
                    'category' => '',
                    'quantity' => 0.0,
                ];
                $name = trim((string) ($columns[$nameColumn] ?? ''));
                $unit = trim((string) ($columns[$unitColumn] ?? ''));
                $category = trim((string) ($columns[$categoryColumn] ?? ''));
                if (($record['name'] !== '' && $name !== '' && strcasecmp($record['name'], $name) !== 0)
                    || ($record['unit'] !== '' && $unit !== '' && strcasecmp($record['unit'], $unit) !== 0)
                    || ($record['category'] !== '' && $category !== '' && strcasecmp($record['category'], $category) !== 0)) {
                    fclose($handle);
                    throw new InvalidArgumentException(sprintf('CSV rows for product %s contain conflicting details.', $code));
                }
                $record['name'] = $record['name'] ?: $name;
                $record['unit'] = $record['unit'] ?: $unit;
                $record['category'] = $record['category'] ?: $category;
                $record['quantity'] += $quantity;
                $imported[$key] = $record;
            }
            fclose($handle);
            if (!$imported || array_sum(array_column($imported, 'quantity')) <= 0) {
                throw new InvalidArgumentException('The CSV contains no positive stock quantities.');
            }

            $nextItems = $items;
            $nextId = app_next_id($nextItems);
            foreach ($imported as $record) {
                $existingIndex = null;
                foreach ($nextItems as $index => $candidate) {
                    if (strcasecmp((string) ($candidate['code'] ?? ''), $record['code']) === 0) {
                        $existingIndex = $index;
                        break;
                    }
                }
                if ($existingIndex !== null) {
                    $nextItems[$existingIndex]['stock'] = (float) ($nextItems[$existingIndex]['stock'] ?? 0) + $record['quantity'];
                    if ($record['category'] !== '') {
                        $nextItems[$existingIndex]['category'] = $record['category'];
                    }
                } else {
                    if ($record['name'] === '') {
                        throw new InvalidArgumentException(sprintf('New product %s needs an Item Name column value.', $record['code']));
                    }
                    $nextItems[] = [
                        'id' => $nextId++,
                        'createdDate' => date('Y-m-d'),
                        'name' => $record['name'],
                        'code' => $record['code'],
                        'type' => 'Finished goods',
                        'category' => $record['category'],
                        'brand' => '',
                        'unit' => $record['unit'] ?: 'Nos',
                        'stock' => $record['quantity'],
                        'price' => 0,
                        'gst' => 18,
                        'description' => '',
                    ];
                }
            }
            $assignments = app_data('ims_warehouse_opening_assignments');
            $codes = array_fill_keys(array_keys($imported), true);
            $assignments = array_values(array_filter($assignments, static fn(array $assignment): bool =>
                !isset($codes[strtolower(trim((string) ($assignment['itemCode'] ?? $assignment['code'] ?? '')))])
            ));
            foreach ($imported as $record) {
                $assignments[] = [
                    'itemCode' => $record['code'],
                    'warehouse' => 'Umbrella Facility Management Services Pvt Ltd',
                ];
            }

            $database = app_database();
            $database->beginTransaction();
            try {
                app_save_items($nextItems);
                app_save_data('ims_warehouse_opening_assignments', $assignments);
                $database->commit();
            } catch (Throwable $exception) {
                if ($database->inTransaction()) {
                    $database->rollBack();
                }
                throw $exception;
            }
            app_flash(sprintf(
                'Imported stock for %d products and assigned opening stock to Umbrella Facility Management Services Pvt Ltd.',
                count($imported)
            ));
            header('Location: ' . app_url('modules/products.php'));
            exit;
        }
        if ($action === 'add') {
            $name = trim((string) ($_POST['name'] ?? ''));
            $code = trim((string) ($_POST['code'] ?? ''));
            if ($name === '' || $code === '') {
                throw new InvalidArgumentException('Product name and code are required.');
            }
            foreach ($items as $item) {
                if (strcasecmp((string) ($item['code'] ?? ''), $code) === 0) {
                    throw new InvalidArgumentException('A product with this code already exists.');
                }
            }
            $items[] = [
                'id' => app_next_id($items),
                'createdDate' => date('Y-m-d'),
                'name' => $name,
                'code' => $code,
                'type' => trim((string) ($_POST['type'] ?? 'Finished goods')),
                'category' => trim((string) ($_POST['category'] ?? '')),
                'brand' => trim((string) ($_POST['brand'] ?? '')),
                'unit' => trim((string) ($_POST['unit'] ?? 'Nos')) ?: 'Nos',
                'stock' => max(0, (float) ($_POST['stock'] ?? 0)),
                'price' => max(0, (float) ($_POST['price'] ?? 0)),
                'gst' => max(0, (float) ($_POST['gst'] ?? 18)),
                'description' => '',
            ];
            app_save_items($items);
            app_flash('Product added.');
            header('Location: ' . app_url('modules/products.php'));
            exit;
        }
        if ($action === 'delete') {
            $code = (string) ($_POST['code'] ?? '');
            $items = array_values(array_filter($items, static fn(array $item): bool => (string) ($item['code'] ?? '') !== $code));
            $assignments = app_data('ims_warehouse_opening_assignments');
            $assignments = array_values(array_filter($assignments, static fn(array $row): bool =>
                strcasecmp((string) ($row['itemCode'] ?? $row['code'] ?? ''), $code) !== 0
            ));
            app_transaction(static function () use ($items, $assignments): void {
                app_save_items($items);
                app_save_data('ims_warehouse_opening_assignments', $assignments);
            });
            app_flash('Product deleted.');
            header('Location: ' . app_url('modules/products.php'));
            exit;
        }
        if ($action === 'delete-all') {
            if (($_POST['confirm_all'] ?? '') !== 'yes') {
                throw new InvalidArgumentException('Confirm the delete-all action first.');
            }
            app_transaction(static function (): void {
                app_save_items([]);
                app_save_data('ims_warehouse_opening_assignments', []);
            });
            app_flash('All products and their opening-stock assignments were deleted.');
            header('Location: ' . app_url('modules/products.php'));
            exit;
        }
    }
} catch (InvalidArgumentException $exception) {
    $error = $exception->getMessage();
} catch (Throwable $exception) {
    app_handle_error($exception, 'Could not load or update PHP products');
}

$activePage = 'products';
$pageTitle = 'Products';
require __DIR__ . '/../includes/header.php';
?>
<section class="page-heading">
    <div><p class="eyebrow">INVENTORY</p><h1>Products</h1><p class="muted">Manage items and opening stock.</p></div>
    <form method="post" onsubmit="return confirm('Delete every product from this account? This cannot be undone.');">
        <input type="hidden" name="csrf_token" value="<?= app_h(app_csrf_token()) ?>">
        <input type="hidden" name="action" value="delete-all">
        <input type="hidden" name="confirm_all" value="yes">
        <button class="button button-danger" type="submit" <?= $items ? '' : 'disabled' ?>>Delete all products</button>
    </form>
</section>
<?php if ($error !== ''): ?><p class="notice notice-error" role="alert"><?= app_h($error) ?></p><?php endif; ?>
<section class="panel">
    <div class="panel-heading"><div><h2>Add product</h2><p class="muted">Products are saved to the current account's MySQL data.</p></div></div>
    <form method="post" class="form-grid">
        <input type="hidden" name="csrf_token" value="<?= app_h(app_csrf_token()) ?>">
        <input type="hidden" name="action" value="add">
        <label>Product name<input name="name" required maxlength="200"></label>
        <label>Product code<input name="code" required maxlength="64"></label>
        <label>Category / department<input name="category" maxlength="100"></label>
        <label>Unit<input name="unit" value="Nos" maxlength="30"></label>
        <label>Opening stock<input name="stock" type="number" min="0" step="0.001" value="0"></label>
        <label>Unit price<input name="price" type="number" min="0" step="0.01" value="0"></label>
        <label>GST %<input name="gst" type="number" min="0" step="0.01" value="18"></label>
        <div class="form-actions"><button class="button button-primary" type="submit">Add product</button></div>
    </form>
</section>
<section class="panel">
    <div class="panel-heading"><div><h2>Upload stock</h2><p class="muted">CSV imports assign opening stock to Umbrella Facility Management Services Pvt Ltd.</p></div></div>
    <form method="post" enctype="multipart/form-data" class="form-grid">
        <input type="hidden" name="csrf_token" value="<?= app_h(app_csrf_token()) ?>">
        <input type="hidden" name="action" value="import">
        <input type="hidden" name="MAX_FILE_SIZE" value="10485760">
        <label>Stock CSV<input name="stock_file" type="file" accept=".csv,text/csv" required></label>
        <p class="muted">Required columns: Item Code and Quantity. Add Item Name for new products; Department and Unit are optional. Export Excel workbooks as CSV first.</p>
        <div class="form-actions"><button class="button button-secondary" type="submit">Upload stock CSV</button></div>
    </form>
</section>
<section class="panel">
    <div class="panel-heading"><div><h2>Product catalogue</h2><p class="muted"><?= count($items) ?> product<?= count($items) === 1 ? '' : 's' ?></p></div></div>
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Code</th><th>Category</th><th>Unit</th><th class="numeric">Stock</th><th>Action</th></tr></thead><tbody>
    <?php foreach ($items as $item): ?>
        <tr><td><?= app_h($item['name'] ?? '') ?></td><td><?= app_h($item['code'] ?? '') ?></td><td><?= app_h($item['category'] ?? '—') ?></td><td><?= app_h($item['unit'] ?? 'Nos') ?></td><td class="numeric"><?= app_h($item['stock'] ?? 0) ?></td><td>
            <form method="post" onsubmit="return confirm('Delete this product?');">
                <input type="hidden" name="csrf_token" value="<?= app_h(app_csrf_token()) ?>">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="code" value="<?= app_h($item['code'] ?? '') ?>">
                <button class="button button-small button-danger" type="submit">Delete</button>
            </form>
        </td></tr>
    <?php endforeach; ?>
    <?php if (!$items): ?><tr><td class="empty-cell" colspan="6">No products yet. Add one above.</td></tr><?php endif; ?>
    </tbody></table></div>
</section>
<?php require __DIR__ . '/../includes/footer.php'; ?>
