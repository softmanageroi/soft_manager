document.addEventListener('DOMContentLoaded', function () {
  const tableBody = document.getElementById('inventoryTableBody');
  if (!tableBody) return;

  const storageKey = 'materialRequisitionVouchers';
  const pageSize = 25;
  let currentPage = 1;
  let currentSource = readVouchers();
  let searchQuery = '';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const formatDate = (value) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };

  function readVouchers() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(stored)) throw new Error('Saved voucher data is invalid.');
      return stored;
    } catch (error) {
      console.error('Could not load material requisitions.', error);
      window.alert('Saved vouchers could not be loaded. Please check browser storage.');
      return [];
    }
  }

  function renderVouchers(sourceVouchers = readVouchers()) {
    currentSource = sourceVouchers;
    const vouchers = sourceVouchers.slice().reverse();
    const query = searchQuery.trim().toLowerCase();
    const visibleVouchers = query
      ? vouchers.filter((voucher) => JSON.stringify(voucher).toLowerCase().includes(query))
      : vouchers;
    const pageCount = Math.max(1, Math.ceil(visibleVouchers.length / pageSize));
    currentPage = Math.min(currentPage, pageCount);
    const pageVouchers = visibleVouchers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    tableBody.innerHTML = pageVouchers.map((voucher, index) => `
      <tr data-doc-no="${escapeHtml(voucher.docNo)}" class="voucher-row" title="Double-click to open this voucher">
        <td><input type="checkbox" class="voucher-select" value="${escapeHtml(voucher.docNo)}" aria-label="Select voucher ${escapeHtml(voucher.docNo)}"></td>
        <td>${(currentPage - 1) * pageSize + index + 1}</td>
        <td>${escapeHtml(formatDate(voucher.date))}</td>
        <td>${escapeHtml(voucher.docNo)}</td>
        <td>${escapeHtml(voucher.createdBy || 'User')}</td>
        <td>${escapeHtml(formatDate(voucher.createdDate || voucher.date))}</td>
        <td>${escapeHtml(voucher.createdTime || '')}</td>
        <td></td>
        <td></td>
        <td></td>
        <td>${voucher.suspended ? 'True' : 'False'}</td>
        <td>${escapeHtml(voucher.authorizationStatus || 'Pending')}</td>
        <td></td>
        <td>${escapeHtml(voucher.linkStatus || 'Pending')}</td>
      </tr>
    `).join('');
    const recordInfo = document.getElementById('recordInfo');
    const firstRecord = visibleVouchers.length ? (currentPage - 1) * pageSize + 1 : 0;
    const lastRecord = Math.min(currentPage * pageSize, visibleVouchers.length);
    if (recordInfo) recordInfo.textContent = `${firstRecord}-${lastRecord} of ${visibleVouchers.length} voucher${visibleVouchers.length === 1 ? '' : 's'}`;
    document.getElementById('currentPage').textContent = String(currentPage);
    document.getElementById('pageCount').textContent = String(pageCount);
    document.getElementById('firstPage').disabled = currentPage === 1;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === pageCount;
    document.getElementById('lastPage').disabled = currentPage === pageCount;
  }

  tableBody.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    const row = event.target.closest('tr[data-doc-no]');
    if (!row) return;
    const docNo = row.dataset.docNo;
    if (!docNo) return;
    window.location.href = `voucher-create.html?docNo=${encodeURIComponent(docNo)}`;
  });

  document.getElementById('createVoucherBtn')?.addEventListener('click', () => {
    window.location.href = 'voucher-create.html';
  });
  document.getElementById('deleteSelectedBtn')?.addEventListener('click', () => {
    const selectedDocNos = new Set(
      Array.from(tableBody.querySelectorAll('.voucher-select:checked')).map((checkbox) => checkbox.value)
    );
    if (!selectedDocNos.size) {
      window.alert('Select at least one voucher to delete.');
      return;
    }
    if (!window.confirm(`Delete ${selectedDocNos.size} selected voucher${selectedDocNos.size === 1 ? '' : 's'}?`)) return;

    try {
      const vouchers = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(vouchers)) throw new Error('Saved voucher data is invalid.');
      const remaining = vouchers.filter((voucher) => !selectedDocNos.has(voucher.docNo));
      localStorage.setItem(storageKey, JSON.stringify(remaining));
      renderVouchers();
    } catch (error) {
      console.error('Could not delete selected material requisitions.', error);
      window.alert('Selected vouchers could not be deleted. Please check browser storage and try again.');
    }
  });
  document.getElementById('selectAll')?.addEventListener('change', (event) => {
    tableBody.querySelectorAll('.voucher-select').forEach((checkbox) => {
      checkbox.checked = event.target.checked;
    });
  });
  document.getElementById('printBtn')?.addEventListener('click', () => {
    const selectedDocNos = new Set(
      Array.from(tableBody.querySelectorAll('.voucher-select:checked')).map((checkbox) => checkbox.value)
    );
    tableBody.querySelectorAll('tr[data-doc-no]').forEach((row) => {
      row.classList.toggle('print-selected', selectedDocNos.has(row.dataset.docNo));
    });
    document.querySelector('.inventory-page')?.classList.toggle('print-selected-only', selectedDocNos.size > 0);
    window.print();
  });
  window.addEventListener('afterprint', () => {
    tableBody.querySelectorAll('.print-selected').forEach((row) => row.classList.remove('print-selected'));
    document.querySelector('.inventory-page')?.classList.remove('print-selected-only');
  });
  document.getElementById('refreshBtn')?.addEventListener('click', renderVouchers);
  document.getElementById('inventorySearch')?.addEventListener('input', (event) => {
    searchQuery = event.target.value;
    currentPage = 1;
    renderVouchers(currentSource);
  });
  document.getElementById('firstPage')?.addEventListener('click', () => { currentPage = 1; renderVouchers(currentSource); });
  document.getElementById('prevPage')?.addEventListener('click', () => { currentPage -= 1; renderVouchers(currentSource); });
  document.getElementById('nextPage')?.addEventListener('click', () => { currentPage += 1; renderVouchers(currentSource); });
  document.getElementById('lastPage')?.addEventListener('click', () => {
    const query = searchQuery.trim().toLowerCase();
    const filteredCount = query
      ? currentSource.filter((voucher) => JSON.stringify(voucher).toLowerCase().includes(query)).length
      : currentSource.length;
    const count = Math.max(1, Math.ceil(filteredCount / pageSize));
    currentPage = count;
    renderVouchers(currentSource);
  });

  const filterPanel = document.getElementById('filterPanel');
  const openFilterButton = document.getElementById('filterBtn');
  const filterFields = {
    startDate: document.getElementById('filterStartDate'),
    endDate: document.getElementById('filterEndDate'),
    warehouse: document.getElementById('filterWarehouse'),
    location: document.getElementById('filterLocation'),
    brand: document.getElementById('filterBrand'),
    item: document.getElementById('filterItem')
  };
  const populateFilterOptions = () => {
    const vouchers = readVouchers();
    const items = vouchers.flatMap((voucher) => Array.isArray(voucher?.items) ? voucher.items : []);
    const values = {
      warehouse: vouchers.map((voucher) => voucher?.warehouse),
      location: vouchers.map((voucher) => voucher?.location),
      brand: items.map((item) => item?.brand),
      item: items.map((item) => item?.item)
    };
    Object.entries(values).forEach(([key, entries]) => {
      const select = filterFields[key];
      if (!select) return;
      const selected = select.value;
      const options = [...new Map(entries
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .map((value) => [value.toLocaleLowerCase(), value])).values()]
        .sort((left, right) => left.localeCompare(right));
      select.replaceChildren(new Option('All', ''));
      options.forEach((value) => select.add(new Option(value, value)));
      select.value = options.some((value) => value.toLocaleLowerCase() === selected.toLocaleLowerCase()) ? selected : '';
    });
  };
  const closeFilter = () => {
    filterPanel?.classList.add('hidden');
    openFilterButton?.setAttribute('aria-expanded', 'false');
    document.querySelector('[data-shared-voucher-action="filter"]')?.setAttribute('aria-expanded', 'false');
  };
  openFilterButton?.setAttribute('aria-expanded', 'false');
  openFilterButton?.addEventListener('click', () => {
    populateFilterOptions();
    filterPanel?.classList.remove('hidden');
    openFilterButton?.setAttribute('aria-expanded', 'true');
    document.querySelector('[data-shared-voucher-action="filter"]')?.setAttribute('aria-expanded', 'true');
  });
  document.getElementById('closeFilterBtn')?.addEventListener('click', closeFilter);
  document.getElementById('clearFilterBtn')?.addEventListener('click', () => {
    Object.values(filterFields).forEach((field) => {
      if (field) field.value = '';
    });
    currentPage = 1;
    renderVouchers();
  });
  filterPanel?.addEventListener('click', (event) => {
    if (event.target === filterPanel) closeFilter();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !filterPanel?.classList.contains('hidden')) closeFilter();
  });
  document.getElementById('applyFilterBtn')?.addEventListener('click', () => {
    const startDate = filterFields.startDate?.value || '';
    const endDate = filterFields.endDate?.value || '';
    if (startDate && endDate && startDate > endDate) {
      window.alert('Start Date must be on or before End Date.');
      return;
    }
    const selectedFilterText = (key) => String(filterFields[key]?.value || '').trim().toLocaleLowerCase();
    const warehouse = selectedFilterText('warehouse');
    const location = selectedFilterText('location');
    const brand = selectedFilterText('brand');
    const item = selectedFilterText('item');
    const filtered = readVouchers().filter((voucher) => {
      const voucherDate = String(voucher?.date || voucher?.createdDate || '');
      const voucherItems = Array.isArray(voucher?.items) ? voucher.items : [];
      return (!startDate || Boolean(voucherDate) && voucherDate >= startDate)
        && (!endDate || Boolean(voucherDate) && voucherDate <= endDate)
        && (!warehouse || String(voucher?.warehouse || '').toLocaleLowerCase() === warehouse)
        && (!location || String(voucher?.location || '').toLocaleLowerCase() === location)
        && (!brand || voucherItems.some((entry) => String(entry?.brand || '').toLocaleLowerCase() === brand))
        && (!item || voucherItems.some((entry) => String(entry?.item || '').toLocaleLowerCase() === item));
    });
    currentPage = 1;
    renderVouchers(filtered);
    closeFilter();
  });
  renderVouchers();
});
