document.addEventListener('DOMContentLoaded', function () {
  const docNoField = document.getElementById('docNo');
  const dateField = document.getElementById('voucherDate');
  const itemsBody = document.getElementById('voucherItemsBody');
  const requestedByField = document.getElementById('requestedBy');
  if (!docNoField || !dateField || !itemsBody || !requestedByField) return;

  IMS.setEmployeeOptions(requestedByField);
  const departmentOptions = IMS.departmentMaster();
  const warehouseOptions = IMS.warehouseMaster();
  const warehouseSelect = document.getElementById('warehouse');
  warehouseSelect.innerHTML = `<option value="">Select warehouse</option>${warehouseOptions.map((warehouse) =>
    `<option value="${IMS.esc(warehouse)}">${IMS.esc(warehouse)}</option>`
  ).join('')}`;
  function renderDepartmentOptions() {
    const departmentSelect = document.getElementById('department');
    const selectedDepartment = departmentSelect.value;
    const options = departmentOptions.map((department) =>
      `<option value="${IMS.esc(department)}">${IMS.esc(department)}</option>`
    ).join('');
    departmentSelect.innerHTML = options;
    if (departmentOptions.includes(selectedDepartment)) departmentSelect.value = selectedDepartment;
  }
  renderDepartmentOptions();

  const vouchersKey = 'materialRequisitionVouchers';
  const counterKey = 'materialRequisitionCounter';
  const saveButton = document.getElementById('saveVoucherBtn');
  const previousButton = document.getElementById('previousVoucherBtn');
  const nextButton = document.getElementById('nextVoucherBtn');
  const requestedDocNo = new URLSearchParams(window.location.search).get('docNo');
  let currentDocNo = '';
  let isSaving = false;

  function refreshItemOptions() {
    const datalist = document.getElementById('materialRequisitionItemOptions');
    if (!datalist) return;
    const items = IMS.items();
    datalist.innerHTML = items.map((item) =>
      `<option value="${IMS.esc(`${item.name} (${item.code})`)}" label="${IMS.esc(`${item.name} (${item.code})${item.brand ? ` — ${item.brand}` : ''}`)}"></option>`
    ).join('');
  }

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function voucherPrefix(date = new Date()) {
    const year = date.getFullYear();
    const startYear = date.getMonth() >= 3 ? year : year - 1;
    return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
  }

  function readVouchers() {
    const stored = JSON.parse(localStorage.getItem(vouchersKey) || '[]');
    if (!Array.isArray(stored)) throw new Error('Saved voucher data is invalid.');
    return stored;
  }

  function createDocumentNumber() {
    const savedVouchers = readVouchers();
    const period = voucherPrefix();
    const seriesCounterKey = `${counterKey}:${period}`;
    const savedNumbers = new Set(savedVouchers.map((voucher) => String(voucher.docNo || '')));
    let nextNumber = Number(localStorage.getItem(seriesCounterKey)) || 0;
    let docNo = '';
    do {
      nextNumber += 1;
      docNo = `MRIU/${period}/${String(nextNumber).padStart(5, '0')}`;
    } while (savedNumbers.has(docNo));
    localStorage.setItem(seriesCounterKey, String(nextNumber));
    return docNo;
  }

  function addItemRow(item = {}) {
    refreshItemOptions();
    const row = document.createElement('tr');
    const fields = [
      { value: '', type: 'text', label: 'Brand' },
      { value: '', type: 'text', label: 'Item' },
      { value: '', type: 'text', label: 'Description' },
      { value: '', type: 'text', label: 'Units' },
      { value: '', type: 'number', label: 'Quantity', min: '0', step: '0.01' },
      { value: '', type: 'number', label: 'Stock in hand', min: '0', step: '0.01', readonly: true }
    ];

    row.innerHTML = `<td></td>${fields.map((field, index) => {
      const key = ['brand', 'item', 'description', 'unit', 'quantity', 'stock'][index];
      const value = item[key] ?? field.value;
      const itemAttrs = index === 1 ? ' list="materialRequisitionItemOptions" autocomplete="off"' : '';
      return `<td><input type="${field.type}" value="${String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" aria-label="${field.label}"${itemAttrs}${field.min ? ` min="${field.min}"` : ''}${field.step ? ` step="${field.step}"` : ''}${field.readonly ? ' readonly' : ''}></td>`;
    }).join('')}`;
    row.dataset.itemCode = item.code || '';
    itemsBody.appendChild(row);
    populateItemDetails(row, item.code || '');
    renumberItems();
  }

  function populateItemDetails(row, preferredCode = '', clearOnMiss = false) {
    const inputs = row.querySelectorAll('input');
    const itemInput = inputs[1];
    const query = itemInput.value.trim().toLocaleLowerCase();
    if (!query) {
      row.dataset.itemCode = '';
      if (clearOnMiss) [0, 2, 3, 5].forEach((index) => { inputs[index].value = ''; });
      return;
    }
    const matches = IMS.items().filter((item) =>
      (preferredCode && String(item.code) === String(preferredCode))
      || item.name.trim().toLocaleLowerCase() === query
      || String(item.code).trim().toLocaleLowerCase() === query
      || `${item.name} (${item.code})`.trim().toLocaleLowerCase() === query
    );
    const item = matches.length === 1 ? matches[0] : null;
    if (!item) {
      row.dataset.itemCode = '';
      if (clearOnMiss) [0, 2, 3, 5].forEach((index) => { inputs[index].value = ''; });
      if (clearOnMiss && query) setStatus('No matching item found. Check the item name or add it in Item Master.');
      return;
    }
    row.dataset.itemCode = item.code;
    itemInput.value = item.name;
    inputs[0].value = item.brand || '';
    inputs[2].value = item.description || '';
    inputs[3].value = item.unit || 'Nos';
    inputs[5].value = String(Number(item.stock) || 0);
    setStatus('');
  }

  function renumberItems() {
    Array.from(itemsBody.rows).forEach((row, index) => {
      row.cells[0].textContent = String(index + 1);
    });
  }

  function collectItems() {
    return Array.from(itemsBody.rows).map((row) => {
      const values = Array.from(row.querySelectorAll('input')).map((input) => input.value.trim());
      return {
        brand: values[0],
        item: values[1],
        code: row.dataset.itemCode || '',
        description: values[2],
        unit: values[3],
        quantity: values[4],
        stock: values[5]
      };
    }).filter((item) => item.brand || item.item || item.description || item.quantity);
  }

  function setStatus(message) {
    let status = document.getElementById('voucherStatus');
    if (!status) {
      status = document.createElement('p');
      status.id = 'voucherStatus';
      status.setAttribute('role', 'status');
      status.style.margin = '10px 0 0';
      document.querySelector('.voucher-footer')?.appendChild(status);
    }
    status.textContent = message;
  }

  function resetForm({ preserveStatus = false } = {}) {
    currentDocNo = createDocumentNumber();
    docNoField.value = currentDocNo;
    dateField.value = localDateString();
    ['warehouse', 'department', 'location', 'requestType'].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.selectedIndex = 0;
    });
    IMS.setEmployeeOptions(requestedByField);
    ['narration'].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.value = '';
    });
    itemsBody.replaceChildren();
    for (let index = 0; index < 5; index += 1) addItemRow();
    if (!preserveStatus) setStatus('');
  }

  function loadVoucher(voucher) {
    currentDocNo = voucher.docNo;
    docNoField.value = voucher.docNo;
    dateField.value = voucher.date || localDateString();
    IMS.setEmployeeOptions(requestedByField, voucher.requestedBy || voucher.authorizedPerson || '');
    ['warehouse', 'department', 'location', 'narration', 'requestType']
      .forEach((id) => {
        const field = document.getElementById(id);
        if (field && voucher[id] !== undefined) field.value = voucher[id];
      });
    requestedByField.value = voucher.requestedBy || voucher.authorizedPerson || '';
    itemsBody.replaceChildren();
    (voucher.items || []).forEach(addItemRow);
    while (itemsBody.rows.length < 5) addItemRow();
    setStatus(`Viewing saved voucher ${voucher.docNo}.`);
  }

  function saveVoucher() {
    if (isSaving) return;

    const items = collectItems();
    if (!dateField.value) {
      window.alert('Please select a voucher date.');
      return;
    }
    if (!items.length || items.some((item) => !item.item || !item.quantity || Number(item.quantity) <= 0)) {
      window.alert('Add at least one item with an item name and quantity greater than zero.');
      return;
    }

    isSaving = true;
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.setAttribute('aria-busy', 'true');
    }

    try {
      const vouchers = readVouchers();
      const now = new Date();
      const voucher = {
        docNo: currentDocNo,
        date: dateField.value,
        warehouse: document.getElementById('warehouse').value,
        department: document.getElementById('department').value,
        location: document.getElementById('location').value,
        requestedBy: requestedByField.value.trim(),
        narration: document.getElementById('narration').value.trim(),
        requestType: document.getElementById('requestType').value,
        items,
        createdBy: localStorage.getItem('loggedInUser') || 'User',
        createdDate: localDateString(now),
        createdTime: now.toLocaleTimeString()
      };
      const existingIndex = vouchers.findIndex((saved) => saved.docNo === currentDocNo);
      if (existingIndex >= 0) vouchers[existingIndex] = { ...vouchers[existingIndex], ...voucher };
      else vouchers.push(voucher);
      localStorage.setItem(vouchersKey, JSON.stringify(vouchers));
      const savedDocNo = voucher.docNo;
      resetForm({ preserveStatus: true });
      setStatus(`Saved ${savedDocNo}. New voucher ${currentDocNo} is ready.`);
    } catch (error) {
      console.error('Could not save material requisition.', error);
      window.alert('Voucher could not be saved. Please check browser storage and try again.');
    } finally {
      isSaving = false;
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.removeAttribute('aria-busy');
      }
    }
  }

  document.getElementById('createVoucherBtn')?.addEventListener('click', () => {
    window.location.href = 'voucher-create.html';
  });
  document.getElementById('addItemBtn')?.addEventListener('click', () => addItemRow());
  itemsBody.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || event.shiftKey || !event.target.matches('input')) return;
    const row = event.target.closest('tr');
    const rowInputs = [...row.querySelectorAll('input:not([readonly])')];
    if (row !== itemsBody.lastElementChild || event.target !== rowInputs.at(-1)) return;

    event.preventDefault();
    addItemRow();
    itemsBody.lastElementChild.querySelector('input')?.focus();
  });
  itemsBody.addEventListener('input', (event) => {
    if (!event.target.matches('input[aria-label="Item"]')) return;
    populateItemDetails(event.target.closest('tr'), '', true);
  });
  itemsBody.addEventListener('change', (event) => {
    if (!event.target.matches('input[aria-label="Item"]')) return;
    populateItemDetails(event.target.closest('tr'), '', true);
  });
  document.getElementById('deleteItemBtn')?.addEventListener('click', () => {
    if (itemsBody.rows.length > 1) itemsBody.deleteRow(-1);
    else itemsBody.rows[0]?.querySelectorAll('input').forEach((input) => { input.value = ''; });
    renumberItems();
  });
  document.getElementById('saveVoucherBtn')?.addEventListener('click', saveVoucher);
  document.getElementById('newVoucherBtn')?.addEventListener('click', () => {
    if (collectItems().some((item) => item.item || item.quantity) &&
        !window.confirm('Discard this unsaved voucher and create a new one?')) return;
    resetForm();
  });
  previousButton?.addEventListener('click', () => {
    if (isSaving || previousButton.disabled) return;
    previousButton.disabled = true;
    nextButton && (nextButton.disabled = true);
    try {
      const vouchers = readVouchers();
      const index = vouchers.findIndex((voucher) => voucher.docNo === currentDocNo);
      const targetIndex = index < 0 ? vouchers.length - 1 : index - 1;
      if (targetIndex >= 0) loadVoucher(vouchers[targetIndex]);
    } finally {
      previousButton.disabled = false;
      nextButton && (nextButton.disabled = false);
    }
  });
  nextButton?.addEventListener('click', () => {
    if (isSaving || nextButton.disabled) return;
    previousButton && (previousButton.disabled = true);
    nextButton.disabled = true;
    try {
      const vouchers = readVouchers();
      const index = vouchers.findIndex((voucher) => voucher.docNo === currentDocNo);
      if (index >= 0 && index < vouchers.length - 1) loadVoucher(vouchers[index + 1]);
      else resetForm();
    } finally {
      previousButton && (previousButton.disabled = false);
      nextButton.disabled = false;
    }
  });
  document.getElementById('printVoucherBtn')?.addEventListener('click', () => window.print());

  try {
    if (requestedDocNo) {
      const vouchers = readVouchers();
      const existingVoucher = vouchers.find((voucher) => voucher.docNo === requestedDocNo);
      if (existingVoucher) {
        loadVoucher(existingVoucher);
      } else {
        window.alert('The selected voucher could not be found. Opening a new voucher instead.');
        resetForm();
      }
    } else {
      resetForm();
    }
  } catch (error) {
    console.error('Could not initialize material requisition.', error);
    window.alert('A new voucher could not be created. Please check browser storage.');
  }
});
