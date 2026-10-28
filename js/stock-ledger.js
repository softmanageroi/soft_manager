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
  const esc = (value) => IMS.esc(value);
  const number = (value) => Number(value) || 0;
  const formatQty = (value) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
  const formatDate = (value) => {
    if (!value) return '—';
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? esc(value) : parsed.toLocaleDateString();
  };
  const getItems = () => IMS.items().slice().sort((a, b) => a.name.localeCompare(b.name));
  let selectedItemCode = '';
  let selectedDepartment = '';
  function itemLabel(item) {
    return `${item.name} (${item.code})`;
  }

  function itemsForSelectedDepartment() {
    return getItems().filter((item) => !selectedDepartment
      || String(item.department || item.category || '').toLocaleLowerCase() === selectedDepartment.toLocaleLowerCase());
  }

  function loadItemOptions() {
    options.innerHTML = itemsForSelectedDepartment().map((item) => `<option value="${esc(itemLabel(item))}"></option>`).join('');
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
    const sameItem = (line) => String(line.code || line.itemCode || '') === code;
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
        if (String(voucher.authorizationStatus || voucher.status || '').toLowerCase() !== 'approved') return;
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
    const selected = search.value.trim().toLocaleLowerCase();
    const item = getItems().find((entry) => itemLabel(entry).toLocaleLowerCase() === selected
      || String(entry.code).toLocaleLowerCase() === selected
      || String(entry.name).toLocaleLowerCase() === selected);
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
    const netAfterStart = allMovements.filter((movement) => movement.date >= start)
      .reduce((sum, movement) => sum + movement.incoming - movement.outgoing, 0);
    const totalIn = movements.reduce((sum, movement) => sum + movement.incoming, 0);
    const totalOut = movements.reduce((sum, movement) => sum + movement.outgoing, 0);
    const currentStock = number(item.stock);
    let balance = currentStock - netAfterStart;

    document.getElementById('selectedItemName').textContent = item.name;
    document.getElementById('selectedItemMeta').textContent = `Code: ${item.code}  •  Brand: ${item.brand || '—'}  •  Unit: ${item.unit || 'Nos'}`;
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

  loadItemOptions();
  loadDepartmentOptions();
  renderDepartmentItems();
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const selected = search.value.trim().toLocaleLowerCase();
    const item = getItems().find((entry) => itemLabel(entry).toLocaleLowerCase() === selected
      || String(entry.code).toLocaleLowerCase() === selected
      || String(entry.name).toLocaleLowerCase() === selected);
    if (!item) {
      result.hidden = true;
      message.textContent = 'List se valid item select karein, phir OK dabayein.';
      return;
    }
    const movements = getMovements(item);
    if (selectedItemCode !== String(item.code) || fromDate.disabled) showLedger(item);
    else renderLedger(item, movements);
  });
  [fromDate, toDate].forEach((field) => field.addEventListener('change', () => {
    dateOption.value = 'as-on-date';
    renderSelectedLedger();
  }));
  dateOption.addEventListener('change', applyDateOption);
  document.getElementById('printLedgerBtn').addEventListener('click', () => window.print());
  window.addEventListener('storage', () => {
    loadItemOptions();
  });
});
