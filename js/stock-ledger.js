document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('stockLedgerForm');
  const search = document.getElementById('ledgerItemSearch');
  const options = document.getElementById('ledgerItemOptions');
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
  function itemLabel(item) {
    return `${item.name} (${item.code})`;
  }

  function loadItemOptions() {
    options.innerHTML = getItems().map((item) => `<option value="${esc(itemLabel(item))}"></option>`).join('');
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
    const selected = search.value.trim().toLocaleLowerCase();
    const item = getItems().find((entry) => itemLabel(entry).toLocaleLowerCase() === selected
      || String(entry.code).toLocaleLowerCase() === selected
      || String(entry.name).toLocaleLowerCase() === selected);
    if (item) renderLedger(item, getMovements(item));
  }));
  document.getElementById('printLedgerBtn').addEventListener('click', () => window.print());
  window.addEventListener('storage', () => {
    loadItemOptions();
  });
});
