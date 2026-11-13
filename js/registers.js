document.addEventListener('DOMContentLoaded', () => {
  const periodType = document.getElementById('registerPeriodType');
  const monthInput = document.getElementById('registerMonth');
  const quarterInput = document.getElementById('registerQuarter');
  const financialYearInput = document.getElementById('registerFinancialYear');
  const startDateInput = document.getElementById('registerStartDate');
  const endDateInput = document.getElementById('registerEndDate');
  const departmentFilter = document.getElementById('registerDepartment');
  const pageTitle = document.getElementById('registerPageTitle');
  const pageDescription = document.getElementById('registerPageDescription');
  const printButton = document.getElementById('printRegisterBtn');
  const purchaseItemSearch = document.getElementById('purchaseItemSearch');
  const itemPurchaseSearchField = purchaseItemSearch?.closest('.register-search-field');
  const exportRegisterButton = document.getElementById('exportRegisterBtn');
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

  if (!periodType || !monthInput || !quarterInput || !financialYearInput || !startDateInput || !endDateInput
      || !departmentFilter || !pageTitle || !pageDescription || !printButton || !purchaseItemSearch || !itemPurchaseSearchField
      || !exportRegisterButton || !requisitionBody || !purchaseOrderBody || !itemPurchaseBody
      || !requisitionView || !purchaseOrderView || !itemPurchaseView
      || !requisitionTab || !purchaseOrderTab || !itemPurchaseTab || !message || !window.IMS) {
    console.error('Registers: required page elements or IMS data helpers are missing.');
    return;
  }

  const esc = IMS.esc;
  let currentRequisitionRows = [];
  let currentPurchaseOrderRows = [];
  let currentItemPurchaseRows = [];
  let currentItemByCode = new Map();
  let currentPeriod = null;
  let activeRegister = 'requisition';
  const today = new Date();
  const currentFinancialYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const currentQuarter = today.getMonth() >= 3
    ? Math.floor((today.getMonth() - 3) / 3) + 1
    : Math.floor((today.getMonth() + 9) / 3) + 1;

  monthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  quarterInput.value = String(currentQuarter);
  financialYearInput.value = String(currentFinancialYear);

  function isoDate(year, month, day) {
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function lastDayOfMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function financialYearLabel(startYear) {
    return `FY ${startYear}-${String(startYear + 1).slice(-2)}`;
  }

  function getPeriod() {
    if (periodType.value === 'monthly') {
      const match = /^(\d{4})-(\d{2})$/.exec(monthInput.value);
      if (!match) return { error: 'Select a valid month.' };
      const year = Number(match[1]);
      const month = Number(match[2]);
      if (year < 1900 || year > 9998 || month < 1 || month > 12) {
        return { error: 'Select a valid month between 1900 and 9998.' };
      }
      const label = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
        .format(new Date(year, month - 1, 1));
      return {
        start: isoDate(year, month, 1),
        end: isoDate(year, month, lastDayOfMonth(year, month)),
        label,
        fileKey: monthInput.value
      };
    }

    if (periodType.value === 'quarterly' || periodType.value === 'yearly') {
      const startYear = Number(financialYearInput.value);
      if (!Number.isInteger(startYear) || startYear < 1900 || startYear > 9998) {
        return { error: 'Enter a valid financial year start (1900 or later).' };
      }
      if (periodType.value === 'yearly') {
        return {
          start: isoDate(startYear, 4, 1),
          end: isoDate(startYear + 1, 3, 31),
          label: financialYearLabel(startYear),
          fileKey: `fy-${startYear}-${startYear + 1}`
        };
      }

      const quarter = Number(quarterInput.value);
      if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
        return { error: 'Select a valid financial quarter.' };
      }
      const startMonth = 4 + ((quarter - 1) * 3);
      const startQuarterYear = quarter === 4 ? startYear + 1 : startYear;
      const firstMonth = quarter === 4 ? 1 : startMonth;
      const lastMonth = quarter === 4 ? 3 : startMonth + 2;
      const endQuarterYear = quarter === 4 ? startYear + 1 : startYear;
      return {
        start: isoDate(startQuarterYear, firstMonth, 1),
        end: isoDate(endQuarterYear, lastMonth, lastDayOfMonth(endQuarterYear, lastMonth)),
        label: `Q${quarter} · ${financialYearLabel(startYear)}`,
        fileKey: `fy-${startYear}-q${quarter}`
      };
    }

    if (periodType.value === 'custom') {
      if (!startDateInput.value || !endDateInput.value) {
        return { error: 'Choose both a start date and an end date.' };
      }
      if (startDateInput.value > endDateInput.value) {
        return { error: 'The start date must be on or before the end date.' };
      }
      return {
        start: startDateInput.value,
        end: endDateInput.value,
        label: `${startDateInput.value} to ${endDateInput.value}`,
        fileKey: `${startDateInput.value}-to-${endDateInput.value}`
      };
    }

    return { start: '', end: '', label: 'All time', fileKey: 'all-time' };
  }

  function dateInPeriod(value, period) {
    const date = typeof value === 'string' ? value.slice(0, 10) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    return (!period.start || date >= period.start) && (!period.end || date <= period.end);
  }

  function normalizeDepartment(value) {
    return String(value || '').trim();
  }

  function getItemDepartment(line, itemByCode) {
    const code = String(line?.code || line?.itemCode || '').toLocaleLowerCase();
    const item = itemByCode.get(code);
    return normalizeDepartment(
      line?.department || line?.departmentName || line?.category
      || item?.department || item?.category
    );
  }

  function getRecordDepartments(record, itemByCode) {
    const departments = [
      normalizeDepartment(record?.department || record?.departmentName)
    ];
    const lines = Array.isArray(record?.lines) ? record.lines : [];
    lines.forEach((line) => departments.push(getItemDepartment(line, itemByCode)));
    const seen = new Set();
    return departments.filter((department) => {
      const key = department.toLocaleLowerCase();
      if (!department || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function matchesDepartment(record, selected, itemByCode) {
    if (!selected) return true;
    const key = selected.toLocaleLowerCase();
    return getRecordDepartments(record, itemByCode)
      .some((department) => department.toLocaleLowerCase() === key);
  }

  function loadData() {
    const raw = localStorage.getItem('materialRequisitionVouchers');
    const requisitions = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(requisitions)) {
      throw new TypeError('Saved material issue vouchers must be a list.');
    }
    const items = IMS.items();
    const itemByCode = new Map(items.map((item) => [String(item.code).toLocaleLowerCase(), item]));
    return {
      requisitions,
      orders: IMS.purchaseOrders(),
      receipts: IMS.mrnAll(),
      itemByCode
    };
  }

  function populateDepartmentFilter(data) {
    const selected = departmentFilter.value;
    const candidates = [
      ...IMS.departmentMaster(),
      ...IMS.departments(),
      ...data.requisitions.flatMap((record) => getRecordDepartments(record, data.itemByCode)),
      ...data.orders.flatMap((record) => getRecordDepartments(record, data.itemByCode)),
      ...data.receipts.flatMap((record) => getRecordDepartments(record, data.itemByCode))
    ];
    const seen = new Set();
    const departments = candidates.map(normalizeDepartment).filter((department) => {
      const key = department.toLocaleLowerCase();
      if (!department || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((left, right) => left.localeCompare(right));

    departmentFilter.replaceChildren(new Option('All departments', ''));
    departments.forEach((department) => departmentFilter.add(new Option(department, department)));
    departmentFilter.value = departments.find((department) =>
      department.toLocaleLowerCase() === selected.toLocaleLowerCase()
    ) || '';
  }

  function clearMessage() {
    message.textContent = '';
    message.hidden = true;
    message.classList.remove('error');
  }

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.hidden = false;
    message.classList.toggle('error', isError);
  }

  function resetTotals() {
    document.getElementById('requisitionCount').textContent = '0';
    document.getElementById('requisitionQuantity').textContent = '0';
    document.getElementById('purchaseOrderCount').textContent = '0';
    document.getElementById('purchaseOrderAmount').textContent = '0.00';
    document.getElementById('itemPurchaseReceiptCount').textContent = '0';
    document.getElementById('itemPurchaseLineCount').textContent = '0';
    document.getElementById('itemPurchaseQuantity').textContent = '0';
    document.getElementById('itemPurchaseAmount').textContent = '0.00';
    currentRequisitionRows = [];
    currentPurchaseOrderRows = [];
    currentItemPurchaseRows = [];
    currentItemByCode = new Map();
    exportRegisterButton.disabled = true;
  }

  function clearReports(text) {
    requisitionBody.innerHTML = `<tr><td colspan="10">${esc(text)}</td></tr>`;
    purchaseOrderBody.innerHTML = `<tr><td colspan="11">${esc(text)}</td></tr>`;
    itemPurchaseBody.innerHTML = `<tr><td colspan="17">${esc(text)}</td></tr>`;
    resetTotals();
  }

  function showError(error) {
    console.error('Could not load purchase and material issue registers.', error);
    const detail = error instanceof Error ? error.message : String(error);
    setMessage(`Could not load the register data: ${detail}`, true);
    clearReports('Unable to load report data.');
  }

  function renderRequisitions(period, department, data) {
    const filtered = data.requisitions.filter((voucher) =>
      voucher && typeof voucher === 'object'
      && dateInPeriod(voucher.date, period)
      && matchesDepartment(voucher, department, data.itemByCode)
    ).sort((left, right) => String(left.date).localeCompare(String(right.date))
      || String(left.docNo).localeCompare(String(right.docNo)));
    currentRequisitionRows = filtered;

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
        <td class="register-action-column"><button class="action-btn has-label register-open-button" type="button" data-open-requisition="${esc(voucher.docNo || '')}">Open</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="10">No material issues match this period and department.</td></tr>';
    document.getElementById('requisitionCount').textContent = String(filtered.length);
    document.getElementById('requisitionQuantity').textContent = String(quantityTotal);
  }

  function renderPurchaseOrders(period, department, data) {
    const filtered = data.orders.filter((order) =>
      order && typeof order === 'object'
      && dateInPeriod(order.date, period)
      && matchesDepartment(order, department, data.itemByCode)
    ).sort((left, right) => String(left.date).localeCompare(String(right.date))
      || String(left.no).localeCompare(String(right.no)));
    currentPurchaseOrderRows = filtered;

    const total = filtered.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    purchaseOrderBody.innerHTML = filtered.length ? filtered.map((order, index) => {
      const departments = getRecordDepartments(order, data.itemByCode).join(', ');
      return `<tr>
        <td>${index + 1}</td>
        <td>${esc(IMS.fmtDate(order.date))}</td>
        <td>${esc(order.no || '')}</td>
        <td>${esc(order.supplier || '')}</td>
        <td>${esc(departments || '—')}</td>
        <td>${esc(order.quotationNo || '')}</td>
        <td>${Array.isArray(order.lines) ? order.lines.length : 0}</td>
        <td>${(Number(order.total) || 0).toFixed(2)}</td>
        <td>${esc(order.status || '')}</td>
        <td>${esc(order.authorizationStatus || 'Pending Authorization')}</td>
        <td class="register-action-column"><button class="action-btn has-label register-open-button" type="button" data-open-purchase-order="${esc(order.id || '')}">Open</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="11">No purchase orders match this period and department.</td></tr>';
    document.getElementById('purchaseOrderCount').textContent = String(filtered.length);
    document.getElementById('purchaseOrderAmount').textContent = total.toFixed(2);
  }

  function getItemPurchaseRows(period, department, data) {
    const ordersById = new Map(data.orders
      .filter((order) => order && typeof order === 'object')
      .map((order) => [String(order.id || ''), order]));
    const receipts = data.receipts.filter((receipt) =>
      receipt && typeof receipt === 'object' && dateInPeriod(receipt.date, period)
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
        const lineDepartment = getItemDepartment(line, data.itemByCode)
          || getItemDepartment(orderLine, data.itemByCode);
        const rowDepartments = lineDepartment
          ? [lineDepartment]
          : getRecordDepartments(order, data.itemByCode);
        if (!rowDepartments.length) rowDepartments.push(...getRecordDepartments(receipt, data.itemByCode));
        const row = {
          receiptDate: String(receipt.date || ''),
          receiptNo: String(receipt.no || ''),
          purchaseOrderNo: String(receipt.poNo || order?.no || ''),
          supplier: String(receipt.supplier || order?.supplier || ''),
          department: rowDepartments.join(', '),
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
          row.purchaseOrderNo, row.receiptNo, row.billNo, row.warehouse, row.department
        ].join(' ').toLocaleLowerCase();
        const departmentMatches = !department || rowDepartments.some((name) =>
          name.toLocaleLowerCase() === department.toLocaleLowerCase()
        );
        if (departmentMatches && (!search || searchable.includes(search))) rows.push(row);
      });
    });

    return rows.sort((left, right) =>
      left.receiptDate.localeCompare(right.receiptDate)
      || left.supplier.localeCompare(right.supplier)
      || left.itemName.localeCompare(right.itemName)
    );
  }

  function renderItemPurchaseReport(period, department, data) {
    currentItemPurchaseRows = getItemPurchaseRows(period, department, data);
    const rows = currentItemPurchaseRows;
    itemPurchaseBody.innerHTML = rows.length ? rows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(IMS.fmtDate(row.receiptDate))}</td>
        <td>${esc(row.receiptNo)}</td>
        <td>${esc(row.purchaseOrderNo)}</td>
        <td>${esc(row.supplier)}</td>
        <td>${esc(row.department || '—')}</td>
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
      </tr>`).join('') : '<tr><td colspan="17">No received items match this period, department, or search.</td></tr>';

    const receiptCount = new Set(rows.map((row) => row.receiptKey)).size;
    const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
    const amount = rows.reduce((sum, row) => sum + row.amount, 0);
    document.getElementById('itemPurchaseReceiptCount').textContent = String(receiptCount);
    document.getElementById('itemPurchaseLineCount').textContent = String(rows.length);
    document.getElementById('itemPurchaseQuantity').textContent = String(quantity);
    document.getElementById('itemPurchaseAmount').textContent = amount.toFixed(2);
    updateExportButton();
  }

  function updateExportButton() {
    const rowCounts = {
      requisition: currentRequisitionRows.length,
      'purchase-order': currentPurchaseOrderRows.length,
      'item-purchase': currentItemPurchaseRows.length
    };
    exportRegisterButton.disabled = !currentPeriod || !rowCounts[activeRegister];
  }

  function updatePeriodControls() {
    const type = periodType.value;
    document.querySelectorAll('[data-period-control]').forEach((control) => {
      const setting = control.dataset.periodControl;
      const visible = setting === type
        || (setting === 'financial-year' && (type === 'quarterly' || type === 'yearly'));
      control.hidden = !visible;
      control.style.display = visible ? '' : 'none';
    });
  }

  function render() {
    const period = getPeriod();
    if (period.error) {
      currentPeriod = null;
      document.querySelectorAll('[data-register-period]').forEach((element) => {
        element.textContent = '—';
      });
      clearReports('Choose a valid reporting period to view results.');
      setMessage(period.error);
      return;
    }

    currentPeriod = period;
    document.querySelectorAll('[data-register-period]').forEach((element) => {
      element.textContent = period.label;
    });
    clearMessage();
    try {
      const data = loadData();
      populateDepartmentFilter(data);
      currentItemByCode = data.itemByCode;
      const department = departmentFilter.value;
      renderRequisitions(period, department, data);
      renderPurchaseOrders(period, department, data);
      renderItemPurchaseReport(period, department, data);
      updateExportButton();
    } catch (error) {
      showError(error);
    }
  }

  function setActiveRegister(type) {
    const showRequisitions = type === 'requisition';
    const showPurchaseOrders = type === 'purchase-order';
    const showItemPurchases = type === 'item-purchase';
    activeRegister = type;
    const pageCopy = {
      requisition: ['Material Issue Register', 'Department-wise material issue records.'],
      'purchase-order': ['Purchase Order Register', 'Department-wise purchase order records.'],
      'item-purchase': ['Item Purchase Report', 'Department-wise report of items actually received.']
    }[type];
    pageTitle.textContent = pageCopy[0];
    pageDescription.textContent = pageCopy[1];
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
    itemPurchaseSearchField.style.display = showItemPurchases ? '' : 'none';
    updateExportButton();
  }

  requisitionTab.addEventListener('click', () => setActiveRegister('requisition'));
  purchaseOrderTab.addEventListener('click', () => setActiveRegister('purchase-order'));
  itemPurchaseTab.addEventListener('click', () => setActiveRegister('item-purchase'));
  periodType.addEventListener('change', () => {
    updatePeriodControls();
    render();
  });
  [monthInput, quarterInput, financialYearInput, startDateInput, endDateInput, departmentFilter]
    .forEach((input) => input.addEventListener('change', render));
  purchaseItemSearch.addEventListener('input', render);
  printButton.addEventListener('click', () => {
    const activeView = !requisitionView.hidden
      ? requisitionView
      : !purchaseOrderView.hidden ? purchaseOrderView : itemPurchaseView;
    activeView.classList.add('is-printing');
    window.addEventListener('afterprint', () => activeView.classList.remove('is-printing'), { once: true });
    window.print();
  });
  exportRegisterButton.addEventListener('click', () => {
    if (!currentPeriod) return;
    let reportName;
    let headers;
    let rows;
    if (activeRegister === 'requisition') {
      reportName = 'material-issue-register';
      headers = ['#', 'Date', 'Voucher No.', 'Warehouse', 'Department', 'Requested By', 'Item Count', 'Total Qty', 'Status'];
      rows = currentRequisitionRows.map((voucher, index) => {
        const items = Array.isArray(voucher.items) ? voucher.items : [];
        const quantity = items.reduce((sum, item) => sum + (Number(item?.qty ?? item?.quantity) || 0), 0);
        return [
          index + 1, voucher.date, voucher.docNo || '', voucher.warehouse || '',
          voucher.department || '', voucher.requestedBy || '', items.length, quantity,
          voucher.authorizationStatus || voucher.status || 'Pending'
        ];
      });
    } else if (activeRegister === 'purchase-order') {
      reportName = 'purchase-order-register';
      headers = ['#', 'Date', 'PO No.', 'Supplier', 'Department', 'Quotation No.', 'Item Count', 'Amount (INR)', 'Status', 'Authorization'];
      rows = currentPurchaseOrderRows.map((order, index) => [
        index + 1, order.date, order.no || '', order.supplier || '',
        getRecordDepartments(order, currentItemByCode).join(', '), order.quotationNo || '',
        Array.isArray(order.lines) ? order.lines.length : 0, Number(order.total) || 0,
        order.status || '', order.authorizationStatus || 'Pending Authorization'
      ]);
    } else {
      reportName = 'item-purchase-report';
      headers = [
        'Receipt Date', 'MRN No.', 'PO No.', 'Supplier', 'Department', 'Bill No.', 'Bill Date',
        'Item Code', 'Item', 'Description', 'Brand', 'Qty Received', 'Unit',
        'Rate (INR)', 'Basic Amount (INR)', 'Warehouse'
      ];
      rows = currentItemPurchaseRows.map((row) => [
        row.receiptDate, row.receiptNo, row.purchaseOrderNo, row.supplier, row.department,
        row.billNo, row.billDate, row.itemCode, row.itemName, row.description, row.brand,
        row.quantity, row.unit, row.rate, row.amount, row.warehouse
      ]);
    }
    if (!rows.length) return;

    const csvCell = (value) => {
      if (typeof value === 'number') return String(value);
      let text = String(value ?? '');
      if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `${reportName}-${currentPeriod.fileKey}.csv`;
      document.body.append(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Could not export the register report.', error);
      setMessage(`Could not download the CSV report: ${error.message}`, true);
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
  updatePeriodControls();
  setActiveRegister('requisition');
  render();
});
