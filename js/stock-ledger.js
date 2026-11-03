document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('stockLedgerForm');
  const search = document.getElementById('ledgerItemSearch');
  const options = document.getElementById('ledgerItemOptions');
  const departmentList = document.getElementById('ledgerDepartmentList');
  const departmentItems = document.getElementById('ledgerDepartmentItems');
  const dateOption = document.getElementById('ledgerDateOption');
  const fromDate = document.getElementById('ledgerFromDate');
  const toDate = document.getElementById('ledgerToDate');
  const message = document.getElementById('ledgerMessage');
  const result = document.getElementById('ledgerResult');
  const rows = document.getElementById('ledgerRows');
  const ledgerView = document.getElementById('stockLedgerView');
  const warehouseView = document.getElementById('warehouseStockView');
  const warehouseSelect = document.getElementById('warehouseStockWarehouse');
  const departmentSelect = document.getElementById('warehouseStockDepartment');
  const warehouseRows = document.getElementById('warehouseStockRows');
  const warehouseMessage = document.getElementById('warehouseStockMessage');
  const warehouseAssignmentStatus = document.getElementById('warehouseAssignmentStatus');
  const stockPageTitle = document.getElementById('stockPageTitle');
  const stockPageDescription = document.getElementById('stockPageDescription');
  const esc = (value) => IMS.esc(value);
  const number = (value) => Number(value) || 0;
  const formatQty = (value) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
  const UNASSIGNED_WAREHOUSE = 'Unassigned warehouse';
  const OPENING_ASSIGNMENTS_KEY = 'ims_warehouse_opening_assignments';
  const formatDate = (value) => {
    if (!value) return '—';
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? esc(value) : parsed.toLocaleDateString();
  };
  const getItems = () => IMS.items().slice().sort((a, b) => a.name.localeCompare(b.name));
  let selectedItemCode = '';
  let selectedDepartment = '';
  let warehouseStock = [];
  function itemLabel(item) {
    return `${item.name} (${item.code})`;
  }

  function itemsForSelectedDepartment() {
    return getItems().filter((item) => !selectedDepartment
      || String(item.department || item.category || '').toLocaleLowerCase() === selectedDepartment.toLocaleLowerCase());
  }

  function loadItemOptions() {
    options.innerHTML = itemsForSelectedDepartment().map((item) =>
      `<option value="${esc(itemLabel(item))}" label="${esc(item.name)} — ${esc(item.code)}"></option>`
    ).join('');
  }

  function findLedgerItem(value) {
    const query = String(value || '').trim().toLocaleLowerCase();
    if (!query) return { item: null, matches: [] };
    const items = getItems();
    const exact = items.filter((item) =>
      [itemLabel(item), item.code, item.name].some((candidate) =>
        String(candidate || '').trim().toLocaleLowerCase() === query
      )
    );
    if (exact.length === 1) return { item: exact[0], matches: exact };
    if (exact.length > 1) return { item: null, matches: exact };
    const matches = items.filter((item) =>
      String(item.name || '').toLocaleLowerCase().includes(query)
      || String(item.code || '').toLocaleLowerCase().includes(query)
    );
    return matches.length === 1 ? { item: matches[0], matches } : { item: null, matches };
  }

  function renderDepartmentItems() {
    if (!departmentItems) return;
    const items = itemsForSelectedDepartment();
    departmentItems.innerHTML = items.length
      ? items.map((item) => `<button class="ledger-item-button" type="button" data-item-code="${esc(item.code)}"><strong>${esc(item.name || item.code)}</strong><small>${esc(item.code)} • ${esc(item.unit || 'Nos')}</small></button>`).join('')
      : '<p class="ledger-items-empty">No items saved in this department.</p>';
    departmentItems.querySelectorAll('[data-item-code]').forEach((button) => button.addEventListener('click', () => {
      const item = getItems().find((entry) => String(entry.code) === button.dataset.itemCode);
      if (!item) return;
      search.value = itemLabel(item);
      showLedger(item);
    }));
  }

  function loadDepartmentOptions() {
    if (!departmentList) return;
    const values = typeof IMS.departments === 'function' && IMS.departments().length
      ? IMS.departments()
      : (typeof IMS.departmentMaster === 'function' ? IMS.departmentMaster() : []);
    departmentList.innerHTML = ['All departments', ...values].map((value, index) =>
      `<button class="ledger-department-item" type="button" role="option" aria-selected="${index === 0}" data-department="${esc(index === 0 ? '' : value)}">${esc(value)}</button>`
    ).join('');
    departmentList.querySelectorAll('.ledger-department-item').forEach((button) => {
      button.addEventListener('click', () => {
        departmentList.querySelectorAll('.ledger-department-item').forEach((entry) => entry.setAttribute('aria-selected', 'false'));
        button.setAttribute('aria-selected', 'true');
        selectedDepartment = button.dataset.department || '';
        selectedItemCode = '';
        search.value = '';
        result.hidden = true;
        fromDate.disabled = true;
        toDate.disabled = true;
        loadItemOptions();
        renderDepartmentItems();
      });
    });
  }

  function getMovements(item) {
    const movements = [];
    const code = String(item.code || '');
    const sameItem = (line) => String(line.code || line.itemCode || '').trim().toLocaleLowerCase() === code.trim().toLocaleLowerCase();
    const merns = JSON.parse(localStorage.getItem('ims_mrn') || '[]');
    if (Array.isArray(merns)) {
      merns.forEach((note) => (note.lines || []).forEach((line) => {
        const qty = number(line.receivedQty ?? line.qty);
        if (!sameItem(line) || qty <= 0) return;
        movements.push({ date: note.date || note.createdDate || '', voucher: note.no || note.id || 'MRN', activity: 'Material received', location: note.warehouse || '', incoming: qty, outgoing: 0 });
      }));
    }

    const requisitions = JSON.parse(localStorage.getItem('materialRequisitionVouchers') || '[]');
    if (Array.isArray(requisitions)) {
      requisitions.forEach((voucher) => {
        if (!['approved', 'authorized', 'issued', 'completed']
          .includes(String(voucher.authorizationStatus || voucher.status || '').trim().toLocaleLowerCase())) return;
        (voucher.items || []).forEach((line) => {
          const qty = number(line.quantity ?? line.qty);
          if (!sameItem(line) || qty <= 0) return;
          movements.push({ date: voucher.date || voucher.createdDate || '', voucher: voucher.docNo || 'Material Requisition', activity: 'Approved material issue', location: [voucher.warehouse, voucher.location].filter(Boolean).join(' / '), incoming: 0, outgoing: qty });
        });
      });
    }
    return movements.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.voucher.localeCompare(b.voucher));
  }

  function itemStartDate(item, movements) {
    const savedDate = item.createdDate || item.createdAt || item.dateCreated;
    if (savedDate && /^\d{4}-\d{2}-\d{2}$/.test(String(savedDate))) return String(savedDate);
    return movements.map((movement) => movement.date).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date))).sort()[0] || IMS.todayISO();
  }

  function setDateRange(item, movements) {
    fromDate.value = itemStartDate(item, movements);
    toDate.value = IMS.todayISO();
    fromDate.min = fromDate.value;
    fromDate.max = toDate.value;
    toDate.min = fromDate.value;
    toDate.max = toDate.value;
    fromDate.disabled = false;
    toDate.disabled = false;
  }

  const toISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const startOfWeek = (date) => {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
    result.setHours(0, 0, 0, 0);
    return result;
  };
  const startOfFinancialYear = (year) => new Date(year, 3, 1);

  function applyDateOption() {
    if (fromDate.disabled) return;
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    let start = new Date(today);
    let end = new Date(today);

    switch (dateOption.value) {
      case 'current-month': start = new Date(currentYear, currentMonth, 1); end = new Date(currentYear, currentMonth + 1, 0); break;
      case 'previous-month': start = new Date(currentYear, currentMonth - 1, 1); end = new Date(currentYear, currentMonth, 0); break;
      case 'current-week': start = startOfWeek(today); break;
      case 'previous-week': start = startOfWeek(today); start.setDate(start.getDate() - 7); end = new Date(start); end.setDate(end.getDate() + 6); break;
      case 'current-year': start = new Date(currentYear, 0, 1); end = new Date(currentYear, 11, 31); break;
      case 'previous-year': start = new Date(currentYear - 1, 0, 1); end = new Date(currentYear - 1, 11, 31); break;
      case 'current-financial-year': { const year = currentMonth >= 3 ? currentYear : currentYear - 1; start = startOfFinancialYear(year); end = new Date(year + 1, 2, 31); break; }
      case 'previous-financial-year': { const year = currentMonth >= 3 ? currentYear - 1 : currentYear - 2; start = startOfFinancialYear(year); end = new Date(year + 1, 2, 31); break; }
      case 'yesterday': start.setDate(start.getDate() - 1); end = new Date(start); break;
      case 'current-quarter': { const quarterStart = Math.floor(currentMonth / 3) * 3; start = new Date(currentYear, quarterStart, 1); end = new Date(currentYear, quarterStart + 3, 0); break; }
      case 'previous-quarter': { const quarterStart = Math.floor(currentMonth / 3) * 3 - 3; start = new Date(currentYear, quarterStart, 1); end = new Date(currentYear, quarterStart + 3, 0); break; }
      case 'today': start = new Date(today); end = new Date(today); break;
      default: return;
    }
    const minimumDate = new Date(`${fromDate.min}T00:00:00`);
    fromDate.value = toISO(start < minimumDate ? minimumDate : start);
    toDate.value = toISO(end > today ? today : end);
    if (fromDate.value > toDate.value) fromDate.value = toDate.value;
    renderSelectedLedger();
  }

  function renderSelectedLedger() {
    const { item } = findLedgerItem(search.value);
    if (item) renderLedger(item, getMovements(item));
  }

  function showLedger(item) {
    const allMovements = getMovements(item);
    selectedItemCode = String(item.code);
    setDateRange(item, allMovements);
    renderLedger(item, allMovements);
  }

  function renderLedger(item, allMovements) {
    const start = fromDate.value;
    const end = toDate.value;
    if (!start || !end || start > end) {
      message.textContent = 'From date, To date se pehle nahi ho sakti.';
      return;
    }
    const movements = allMovements.filter((movement) => movement.date >= start && movement.date <= end);
    const netFromStart = allMovements.filter((movement) => movement.date >= start)
      .reduce((sum, movement) => sum + movement.incoming - movement.outgoing, 0);
    const totalIn = movements.reduce((sum, movement) => sum + movement.incoming, 0);
    const totalOut = movements.reduce((sum, movement) => sum + movement.outgoing, 0);
    const currentStock = number(item.stock)
      - allMovements.reduce((sum, movement) => sum + movement.outgoing, 0);
    let balance = currentStock - netFromStart;

    document.getElementById('selectedItemName').textContent = item.name;
    document.getElementById('selectedItemMeta').textContent = `Code: ${item.code}  •  Department: ${item.department || item.category || '—'}  •  Brand: ${item.brand || '—'}  •  Unit: ${item.unit || 'Nos'}`;
    document.getElementById('openingBalance').textContent = formatQty(balance);
    document.getElementById('totalIn').textContent = formatQty(totalIn);
    document.getElementById('totalOut').textContent = formatQty(totalOut);
    document.getElementById('currentBalance').textContent = formatQty(currentStock);

    rows.innerHTML = movements.map((movement, index) => {
      balance += movement.incoming - movement.outgoing;
      return `<tr><td>${index + 1}</td><td>${formatDate(movement.date)}</td><td>${esc(movement.voucher)}</td><td>${esc(movement.activity)}</td><td>${esc(movement.location || '—')}</td><td>${movement.incoming ? formatQty(movement.incoming) : '—'}</td><td>${movement.outgoing ? formatQty(movement.outgoing) : '—'}</td><td>${formatQty(balance)}</td></tr>`;
    }).join('');
    document.getElementById('ledgerEmptyState').hidden = movements.length > 0;
    result.hidden = false;
    message.textContent = '';
  }

  function savedArray(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) throw new TypeError(`Saved ${key} data must be an array.`);
    return value;
  }

  function warehouseStockData() {
    if (!window.WarehouseStockReport?.buildRows) {
      throw new Error('Warehouse stock report could not be loaded. Refresh the page and try again.');
    }
    return WarehouseStockReport.buildRows(
      getItems(),
      IMS.mrnAll(),
      savedArray('materialRequisitionVouchers'),
      savedArray(OPENING_ASSIGNMENTS_KEY)
    );
  }

  function renderWarehouseStock() {
    warehouseAssignmentStatus.textContent = '';
    try {
      const report = warehouseStockData();
      warehouseStock = report.rows;
      const selectedWarehouse = warehouseSelect.value;
      const selectedDepartmentValue = departmentSelect.value;
      const warehouses = [...new Set([
        ...IMS.warehouseMaster(),
        ...warehouseStock.map((row) => row.warehouse)
      ])].sort((first, second) => first.localeCompare(second));
      const departments = [...new Set(warehouseStock.map((row) => row.department))]
        .sort((first, second) => first.localeCompare(second));
      const assignableWarehouses = [...new Set(IMS.warehouseMaster())]
        .sort((first, second) => first.localeCompare(second));

      warehouseSelect.innerHTML = `<option value="">All warehouses</option>${warehouses.map((name) =>
        `<option value="${esc(name)}">${esc(name)}</option>`
      ).join('')}`;
      if (warehouses.includes(selectedWarehouse)) warehouseSelect.value = selectedWarehouse;
      departmentSelect.innerHTML = `<option value="">All departments</option>${departments.map((name) =>
        `<option value="${esc(name)}">${esc(name)}</option>`
      ).join('')}`;
      if (departments.includes(selectedDepartmentValue)) departmentSelect.value = selectedDepartmentValue;

      const visibleRows = filteredWarehouseRows();
      warehouseRows.innerHTML = visibleRows.length ? visibleRows.map((row) => `
        <tr>
          <td>${esc(row.warehouse)}</td>
          <td>${esc(row.department)}</td>
          <td>${esc(row.itemName)}</td>
          <td>${esc(row.itemCode)}</td>
          <td>${esc(row.unit)}</td>
          <td style="text-align: right;">${formatQty(row.quantity)}</td>
          <td>${row.openingBalance > 0 ? `
            <select data-opening-warehouse="${esc(row.itemCode)}" aria-label="Warehouse for ${esc(row.itemName)}">
              ${[...new Set([UNASSIGNED_WAREHOUSE, ...assignableWarehouses, row.openingWarehouse])].map((name) =>
                `<option value="${esc(name)}" ${row.openingWarehouse === name ? 'selected' : ''}>${esc(name)}</option>`
              ).join('')}
            </select>
            <button class="btn-secondary" type="button" data-save-opening-warehouse="${esc(row.itemCode)}" ${!assignableWarehouses.length && row.openingWarehouse === UNASSIGNED_WAREHOUSE ? 'disabled' : ''}>Save</button>
            <small style="display: block; color: var(--erp-text-muted);">Opening: ${formatQty(row.openingBalance)}</small>
          ` : '—'}</td>
        </tr>
      `).join('') : '<tr><td colspan="7" style="text-align: center; padding: 20px;">No stock found for this warehouse and department.</td></tr>';
      warehouseRows.querySelectorAll('[data-save-opening-warehouse]').forEach((button) => {
        button.addEventListener('click', () => {
          const itemCode = button.dataset.saveOpeningWarehouse;
          const select = button.closest('td')?.querySelector('[data-opening-warehouse]');
          if (!select) return;
          const warehouse = select.value;
          const itemName = select.getAttribute('aria-label')?.replace(/^Warehouse for /, '') || itemCode;
          try {
            const assignments = savedArray(OPENING_ASSIGNMENTS_KEY)
              .filter((assignment) => String(assignment?.itemCode || assignment?.code || '').trim().toLocaleLowerCase()
                !== itemCode.trim().toLocaleLowerCase());
            if (warehouse !== UNASSIGNED_WAREHOUSE) assignments.push({ itemCode, warehouse });
            localStorage.setItem(OPENING_ASSIGNMENTS_KEY, JSON.stringify(assignments));
          } catch (error) {
            console.error('Could not save opening stock warehouse assignment.', error);
            warehouseAssignmentStatus.textContent = `Could not save warehouse assignment: ${error.message}`;
            return;
          }
          renderWarehouseStock();
          warehouseAssignmentStatus.textContent = warehouse === UNASSIGNED_WAREHOUSE
            ? `${itemName} returned to Unassigned warehouse.`
            : `Opening stock assigned to ${warehouse}.`;
        });
      });
      if (!assignableWarehouses.length) {
        warehouseAssignmentStatus.textContent = 'To assign opening stock, add a warehouse in Warehouse Master first.';
      }
      document.getElementById('warehouseStockSummary').textContent =
        `${visibleRows.length} stock row${visibleRows.length === 1 ? '' : 's'}`;
      document.getElementById('downloadWarehouseStockCsv').disabled = visibleRows.length === 0;
      const warningDetails = report.warnings.slice(0, 3).join(' ');
      const moreWarnings = report.warnings.length > 3
        ? ` ${report.warnings.length - 3} more reconciliation warning${report.warnings.length - 3 === 1 ? '' : 's'}.`
        : '';
      warehouseMessage.textContent = report.warnings.length
        ? `Opening balances without a warehouse are shown as Unassigned warehouse. Reconcile: ${warningDetails}${moreWarnings}`
        : 'Warehouse balances use received quantities minus approved issues. Opening balances can be assigned here or left under Unassigned warehouse.';
    } catch (error) {
      console.error('Could not load warehouse stock report.', error);
      warehouseRows.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Warehouse stock could not be loaded.</td></tr>`;
      document.getElementById('warehouseStockSummary').textContent = 'Report unavailable';
      document.getElementById('downloadWarehouseStockCsv').disabled = true;
      warehouseMessage.textContent = `Warehouse stock report error: ${error.message}`;
    }
  }

  function filteredWarehouseRows() {
    const warehouse = warehouseSelect.value.toLocaleLowerCase();
    const department = departmentSelect.value.toLocaleLowerCase();
    return warehouseStock.filter((row) =>
      (!warehouse || row.warehouse.toLocaleLowerCase() === warehouse)
      && (!department || row.department.toLocaleLowerCase() === department)
    );
  }

  function downloadWarehouseStock() {
    const data = filteredWarehouseRows();
    if (!data.length) return;
    const columns = [
      ['Warehouse', 'warehouse'],
      ['Department', 'department'],
      ['Item Name', 'itemName'],
      ['Item Code', 'itemCode'],
      ['Unit', 'unit'],
      ['Stock Quantity', 'quantity']
    ];
    const csvCell = (value) => {
      const text = String(value ?? '');
      const safeText = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    };
    const csv = `\uFEFF${[columns.map(([label]) => label), ...data.map((row) =>
      columns.map(([, key]) => row[key])
    )].map((line) => line.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `warehouse-stock-${IMS.todayISO()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setStockView(view, updateUrl = false) {
    const isWarehouse = view === 'warehouse';
    ledgerView.hidden = isWarehouse;
    warehouseView.hidden = !isWarehouse;
    stockPageTitle.textContent = isWarehouse ? 'Warehouse Stock' : 'Stock Ledger';
    stockPageDescription.textContent = isWarehouse
      ? 'View warehouse item balances grouped by department and download the filtered report.'
      : 'Detailed movement history for items including receipts and issues.';
    document.querySelectorAll('[data-stock-view]').forEach((link) => {
      const active = link.dataset.stockView === view;
      link.classList.toggle('active', active);
      link.setAttribute('aria-current', active ? 'page' : 'false');
    });
    document.querySelectorAll('[data-sidebar-stock-view]').forEach((link) => {
      link.classList.toggle('active', link.dataset.sidebarStockView === view);
    });
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.hash = isWarehouse ? 'warehouse-stock' : '';
      window.history.replaceState(null, '', url);
    }
    if (isWarehouse) renderWarehouseStock();
  }

  loadItemOptions();
  loadDepartmentOptions();
  renderDepartmentItems();
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const { item, matches } = findLedgerItem(search.value);
    if (!item) {
      result.hidden = true;
      message.textContent = matches.length > 1
        ? 'Same name ke kai items mile. Suggestion list se item name ke saath code bhi select karein.'
        : 'Item name ya code match nahi hua. Suggestion list se item select karein.';
      return;
    }
    search.value = itemLabel(item);
    const movements = getMovements(item);
    if (selectedItemCode !== String(item.code) || fromDate.disabled) showLedger(item);
    else renderLedger(item, movements);
  });
  search.addEventListener('change', () => {
    const { item } = findLedgerItem(search.value);
    if (item) showLedger(item);
  });
  [fromDate, toDate].forEach((field) => field.addEventListener('change', () => {
    dateOption.value = 'as-on-date';
    renderSelectedLedger();
  }));
  dateOption.addEventListener('change', applyDateOption);
  document.getElementById('printLedgerBtn').addEventListener('click', () => window.print());
  warehouseSelect.addEventListener('change', renderWarehouseStock);
  departmentSelect.addEventListener('change', renderWarehouseStock);
  document.getElementById('downloadWarehouseStockCsv').addEventListener('click', downloadWarehouseStock);
  window.addEventListener('hashchange', () => {
    setStockView(window.location.hash === '#warehouse-stock' ? 'warehouse' : 'ledger');
  });
  setStockView(window.location.hash === '#warehouse-stock' ? 'warehouse' : 'ledger');
  window.addEventListener('storage', () => {
    loadItemOptions();
    renderWarehouseStock();
  });
});
