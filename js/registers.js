document.addEventListener('DOMContentLoaded', () => {
  const monthInput = document.getElementById('registerMonth');
  const printButton = document.getElementById('printRegisterBtn');
  const purchaseItemSearch = document.getElementById('purchaseItemSearch');
  const itemPurchaseSearchField = purchaseItemSearch?.closest('.register-search-field');
  const exportPurchaseItemsButton = document.getElementById('exportPurchaseItemsBtn');
  const requisitionBody = document.getElementById('requisitionRegisterBody');
  const purchaseOrderBody = document.getElementById('purchaseOrderRegisterBody');
  const itemPurchaseBody = document.getElementById('itemPurchaseRegisterBody');
  const requisitionView = document.getElementById('materialRequisitionRegister');
  const purchaseOrderView = document.getElementById('purchaseOrderRegister');
  const itemPurchaseView = document.getElementById('itemPurchaseRegister');
  const requisitionTab = document.getElementById('tabMaterialRequisition');
  const purchaseOrderTab = document.getElementById('tabPurchaseOrder');
  const itemPurchaseTab = document.getElementById('tabItemPurchase');
  const message = document.getElementById('registerMessage');

  if (!monthInput || !printButton || !purchaseItemSearch || !itemPurchaseSearchField
      || !exportPurchaseItemsButton || !requisitionBody || !purchaseOrderBody || !itemPurchaseBody
      || !requisitionView || !purchaseOrderView || !itemPurchaseView
      || !requisitionTab || !purchaseOrderTab || !itemPurchaseTab || !message || !window.IMS) {
    console.error('Registers: required page elements or IMS data helpers are missing.');
    return;
  }

  const esc = IMS.esc;
  let currentItemPurchaseRows = [];
  const currentDate = new Date();
  monthInput.value = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  function monthLabel(value) {
    if (!value) return 'Select a month';
    const [year, month] = value.split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
      .format(new Date(year, month - 1, 1));
  }

  function dateInMonth(value, month) {
    return typeof value === 'string' && /^\d{4}-\d{2}/.test(value)
      && value.slice(0, 7) === month;
  }

  function showError(error) {
    console.error('Could not load monthly registers.', error);
    message.textContent = `Could not load the register data: ${error.message}`;
    message.hidden = false;
    message.classList.add('error');
    requisitionBody.innerHTML = '<tr><td colspan="10">Unable to load material issue vouchers.</td></tr>';
    purchaseOrderBody.innerHTML = '<tr><td colspan="10">Unable to load purchase orders.</td></tr>';
    itemPurchaseBody.innerHTML = '<tr><td colspan="16">Unable to load item purchase details.</td></tr>';
    currentItemPurchaseRows = [];
    exportPurchaseItemsButton.disabled = true;
    document.getElementById('requisitionCount').textContent = '0';
    document.getElementById('requisitionQuantity').textContent = '0';
    document.getElementById('purchaseOrderCount').textContent = '0';
    document.getElementById('purchaseOrderAmount').textContent = '0.00';
    document.getElementById('itemPurchaseReceiptCount').textContent = '0';
    document.getElementById('itemPurchaseLineCount').textContent = '0';
    document.getElementById('itemPurchaseQuantity').textContent = '0';
    document.getElementById('itemPurchaseAmount').textContent = '0.00';
  }

  function renderRequisitions(month) {
    const raw = localStorage.getItem('materialRequisitionVouchers');
    const vouchers = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(vouchers)) throw new TypeError('Saved material issue vouchers must be a list.');
    const filtered = vouchers.filter((voucher) =>
      voucher && typeof voucher === 'object' && dateInMonth(voucher.date, month)
    ).sort((left, right) => String(left.date).localeCompare(String(right.date))
      || String(left.docNo).localeCompare(String(right.docNo)));

    let quantityTotal = 0;
    requisitionBody.innerHTML = filtered.length ? filtered.map((voucher, index) => {
      const items = Array.isArray(voucher.items) ? voucher.items : [];
      const quantity = items.reduce((sum, item) => sum + (Number(item?.qty ?? item?.quantity) || 0), 0);
      quantityTotal += quantity;
      const status = String(voucher.authorizationStatus || voucher.status || 'Pending');
      return `<tr>
        <td>${index + 1}</td>
        <td>${esc(IMS.fmtDate(voucher.date))}</td>
        <td>${esc(voucher.docNo || '')}</td>
        <td>${esc(voucher.warehouse || '')}</td>
        <td>${esc(voucher.department || '')}</td>
        <td>${esc(voucher.requestedBy || '')}</td>
        <td>${items.length}</td>
        <td>${quantity}</td>
        <td>${esc(status)}</td>
        <td><button class="action-btn has-label register-open-button" type="button" data-open-requisition="${esc(voucher.docNo || '')}">Open</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="10">No material issue vouchers for this month.</td></tr>';
    document.getElementById('requisitionCount').textContent = String(filtered.length);
    document.getElementById('requisitionQuantity').textContent = String(quantityTotal);
  }

  function renderPurchaseOrders(month) {
    const filtered = IMS.purchaseOrders().filter((order) =>
      order && typeof order === 'object' && dateInMonth(order.date, month)
    ).sort((left, right) => String(left.date).localeCompare(String(right.date))
      || String(left.no).localeCompare(String(right.no)));

    const total = filtered.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    purchaseOrderBody.innerHTML = filtered.length ? filtered.map((order, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(IMS.fmtDate(order.date))}</td>
        <td>${esc(order.no || '')}</td>
        <td>${esc(order.supplier || '')}</td>
        <td>${esc(order.quotationNo || '')}</td>
        <td>${Array.isArray(order.lines) ? order.lines.length : 0}</td>
        <td>${(Number(order.total) || 0).toFixed(2)}</td>
        <td>${esc(order.status || '')}</td>
        <td>${esc(order.authorizationStatus || 'Pending Authorization')}</td>
        <td><button class="action-btn has-label register-open-button" type="button" data-open-purchase-order="${esc(order.id || '')}">Open</button></td>
      </tr>`).join('') : '<tr><td colspan="10">No purchase orders for this month.</td></tr>';
    document.getElementById('purchaseOrderCount').textContent = String(filtered.length);
    document.getElementById('purchaseOrderAmount').textContent = total.toFixed(2);
  }

  function getItemPurchaseRows(month) {
    const orders = IMS.purchaseOrders();
    const ordersById = new Map(orders
      .filter((order) => order && typeof order === 'object')
      .map((order) => [String(order.id || ''), order]));
    const receipts = IMS.mrnAll().filter((receipt) =>
      receipt && typeof receipt === 'object' && dateInMonth(receipt.date, month)
    );
    const search = purchaseItemSearch.value.trim().toLocaleLowerCase();
    const rows = [];

    receipts.forEach((receipt) => {
      const order = ordersById.get(String(receipt.poId || ''));
      const lines = Array.isArray(receipt.lines) ? receipt.lines : [];
      lines.forEach((line) => {
        if (!line || typeof line !== 'object') return;
        const quantity = Number(line.receivedQty);
        if (!Number.isFinite(quantity) || quantity <= 0) return;
        const orderLines = Array.isArray(order?.lines) ? order.lines : [];
        const orderLineByCode = line.code
          ? orderLines.find((candidate) => String(candidate?.code || '') === String(line.code))
          : null;
        const hasLineIndex = line.poLineIndex !== undefined && line.poLineIndex !== null && line.poLineIndex !== '';
        const orderLineByIndex = hasLineIndex && Number.isInteger(Number(line.poLineIndex))
          ? orderLines[Number(line.poLineIndex)]
          : null;
        const orderLine = orderLineByCode || orderLineByIndex;
        const rateValue = Number(line.rate ?? orderLine?.rate);
        const rate = Number.isFinite(rateValue) ? rateValue : 0;
        const row = {
          receiptDate: String(receipt.date || ''),
          receiptNo: String(receipt.no || ''),
          purchaseOrderNo: String(receipt.poNo || order?.no || ''),
          supplier: String(receipt.supplier || order?.supplier || ''),
          billNo: String(receipt.billNumber || order?.authorizationDetails?.billNumber || ''),
          billDate: String(receipt.billDate || order?.authorizationDetails?.billDate || ''),
          itemCode: String(line.code || orderLine?.code || ''),
          itemName: String(line.name || line.itemName || orderLine?.name || orderLine?.itemName || ''),
          description: String(line.description || orderLine?.description || ''),
          brand: String(line.brand || orderLine?.brand || ''),
          quantity,
          unit: String(line.unit || orderLine?.unit || ''),
          rate,
          amount: quantity * rate,
          warehouse: String(receipt.warehouse || order?.authorizationDetails?.warehouse || order?.printDetails?.warehouse || ''),
          receiptKey: String(receipt.id || receipt.no || `${receipt.poNo || ''}/${receipt.date || ''}`)
        };
        const searchable = [
          row.itemCode, row.itemName, row.description, row.brand, row.supplier,
          row.purchaseOrderNo, row.receiptNo, row.billNo, row.warehouse
        ].join(' ').toLocaleLowerCase();
        if (!search || searchable.includes(search)) rows.push(row);
      });
    });

    return rows.sort((left, right) =>
      left.receiptDate.localeCompare(right.receiptDate)
      || left.supplier.localeCompare(right.supplier)
      || left.itemName.localeCompare(right.itemName)
    );
  }

  function renderItemPurchaseReport(month) {
    currentItemPurchaseRows = getItemPurchaseRows(month);
    const rows = currentItemPurchaseRows;
    itemPurchaseBody.innerHTML = rows.length ? rows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(IMS.fmtDate(row.receiptDate))}</td>
        <td>${esc(row.receiptNo)}</td>
        <td>${esc(row.purchaseOrderNo)}</td>
        <td>${esc(row.supplier)}</td>
        <td>${esc(row.billNo)}</td>
        <td>${esc(IMS.fmtDate(row.billDate))}</td>
        <td>${esc(row.itemCode)}</td>
        <td>${esc(row.itemName)}</td>
        <td>${esc(row.description)}</td>
        <td>${esc(row.brand)}</td>
        <td>${row.quantity}</td>
        <td>${esc(row.unit)}</td>
        <td>${row.rate.toFixed(2)}</td>
        <td>${row.amount.toFixed(2)}</td>
        <td>${esc(row.warehouse)}</td>
      </tr>`).join('') : '<tr><td colspan="16">No received item purchases for this month or search.</td></tr>';

    const receiptCount = new Set(rows.map((row) => row.receiptKey)).size;
    const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
    const amount = rows.reduce((sum, row) => sum + row.amount, 0);
    document.getElementById('itemPurchaseReceiptCount').textContent = String(receiptCount);
    document.getElementById('itemPurchaseLineCount').textContent = String(rows.length);
    document.getElementById('itemPurchaseQuantity').textContent = String(quantity);
    document.getElementById('itemPurchaseAmount').textContent = amount.toFixed(2);
    exportPurchaseItemsButton.disabled = rows.length === 0;
  }

  function render() {
    if (!monthInput.value) {
      message.textContent = 'Select a month to view its reports.';
      message.hidden = false;
      return;
    }
    message.hidden = true;
    message.classList.remove('error');
    document.querySelectorAll('[data-register-period]').forEach((element) => {
      element.textContent = monthLabel(monthInput.value);
    });
    try {
      renderRequisitions(monthInput.value);
      renderPurchaseOrders(monthInput.value);
      renderItemPurchaseReport(monthInput.value);
    } catch (error) {
      showError(error);
    }
  }

  function setActiveRegister(type) {
    const showRequisitions = type === 'requisition';
    const showPurchaseOrders = type === 'purchase-order';
    const showItemPurchases = type === 'item-purchase';
    requisitionTab.classList.toggle('active', showRequisitions);
    purchaseOrderTab.classList.toggle('active', showPurchaseOrders);
    itemPurchaseTab.classList.toggle('active', showItemPurchases);
    requisitionTab.setAttribute('aria-selected', String(showRequisitions));
    purchaseOrderTab.setAttribute('aria-selected', String(showPurchaseOrders));
    itemPurchaseTab.setAttribute('aria-selected', String(showItemPurchases));
    requisitionView.hidden = !showRequisitions;
    purchaseOrderView.hidden = !showPurchaseOrders;
    itemPurchaseView.hidden = !showItemPurchases;
    itemPurchaseSearchField.hidden = !showItemPurchases;
    exportPurchaseItemsButton.hidden = !showItemPurchases;
  }

  requisitionTab.addEventListener('click', () => setActiveRegister('requisition'));
  purchaseOrderTab.addEventListener('click', () => setActiveRegister('purchase-order'));
  itemPurchaseTab.addEventListener('click', () => setActiveRegister('item-purchase'));
  monthInput.addEventListener('change', render);
  purchaseItemSearch.addEventListener('input', render);
  printButton.addEventListener('click', () => {
    const activeView = !requisitionView.hidden
      ? requisitionView
      : !purchaseOrderView.hidden ? purchaseOrderView : itemPurchaseView;
    activeView.classList.add('is-printing');
    window.addEventListener('afterprint', () => activeView.classList.remove('is-printing'), { once: true });
    window.print();
  });
  exportPurchaseItemsButton.addEventListener('click', () => {
    if (!currentItemPurchaseRows.length) return;
    const headers = [
      'Receipt Date', 'MRN No.', 'PO No.', 'Supplier', 'Bill No.', 'Bill Date',
      'Item Code', 'Item', 'Description', 'Brand', 'Qty Received', 'Unit',
      'Rate (INR)', 'Basic Amount (INR)', 'Warehouse'
    ];
    const csvCell = (value) => {
      if (typeof value === 'number') return String(value);
      let text = String(value ?? '');
      if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csvRows = currentItemPurchaseRows.map((row) => [
      row.receiptDate, row.receiptNo, row.purchaseOrderNo, row.supplier, row.billNo, row.billDate,
      row.itemCode, row.itemName, row.description, row.brand, row.quantity, row.unit,
      row.rate, row.amount, row.warehouse
    ]);
    const csv = `\uFEFF${[headers, ...csvRows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `item-purchase-report-${monthInput.value}.csv`;
      document.body.append(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Could not export the item purchase report.', error);
      message.textContent = `Could not download the Excel-compatible report: ${error.message}`;
      message.hidden = false;
      message.classList.add('error');
    }
  });

  requisitionBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-requisition]');
    if (!button) return;
    const params = new URLSearchParams({ docNo: button.dataset.openRequisition, returnTo: 'all' });
    window.location.href = `voucher-create.html?${params.toString()}`;
  });
  purchaseOrderBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-purchase-order]');
    if (!button) return;
    const params = new URLSearchParams({ orderId: button.dataset.openPurchaseOrder });
    window.location.href = `purchase-order-creation.html?${params.toString()}`;
  });

  window.addEventListener('storage', render);
  setActiveRegister('requisition');
  render();
});
