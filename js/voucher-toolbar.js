document.addEventListener('DOMContentLoaded', () => {
  // Procurement screens use their own labeled controls; don't inject a second icon toolbar.
  if (document.body.classList.contains('purchase-voucher-page') || document.querySelector('.purchase-indent-shell')) return;
  const host = document.querySelector('.inventory-actions, .page-header-tools, .voucher-actions');
  if (!host || host.querySelector('[data-shared-voucher-action]')) return;

  const actions = [
    ['new', 'fa-circle-plus', 'New voucher'],
    ['save', 'fa-floppy-disk', 'Save voucher'],
    ['delete', 'fa-trash-can', 'Delete selected voucher'],
    ['print', 'fa-print', 'Print'],
    ['email', 'fa-envelope', 'Create email'],
    ['barcode', 'fa-barcode', 'Copy voucher number for barcode'],
    ['approve', 'fa-check', 'Approve selected'],
    ['hold', 'fa-pause', 'Hold selected'],
    ['reject', 'fa-xmark', 'Reject selected'],
    ['cancel', 'fa-xmark', 'Cancel or return to list'],
    ['clear', 'fa-circle-xmark', 'Clear selection or filter'],
    ['info', 'fa-circle-info', 'Voucher information'],
    ['refresh', 'fa-rotate', 'Refresh list'],
    ['sort', 'fa-arrow-down-short-wide', 'Sort rows'],
    ['filter', 'fa-filter', 'Filter or search'],
    ['settings', 'fa-gear', 'Toggle compact rows'],
    ['export', 'fa-file-export', 'Export visible table to CSV'],
    ['collapse', 'fa-chevron-up', 'Collapse or expand list']
  ];

  const bar = document.createElement('div');
  bar.className = 'shared-voucher-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Voucher actions');
  bar.innerHTML = actions.map(([action, icon, label]) =>
    `<button type="button" class="shared-voucher-action" data-shared-voucher-action="${action}" title="${label}" aria-label="${label}"><i class="fa-solid ${icon}" aria-hidden="true"></i></button>`
  ).join('');
  host.append(bar);

  const nativeToolbarActions = {
    new: ['createVoucherBtn', 'newVoucherBtn', 'piNewBtn', 'newOrderBtn', 'newWorkflowBtn'],
    save: ['saveVoucherBtn', 'saveOrderTopBtn', 'piSaveBtn', 'rfqSaveBtn', 'qrSaveBtn', 'saveOrderBtn', 'saveWorkflowBtn'],
    delete: ['deleteSelectedBtn'], print: ['printBtn', 'printVoucherBtn'],
    email: ['sendBtn', 'emailVoucherBtn'], barcode: ['barcodeBtn'],
    approve: ['authorizeBtn', 'authorizeSelectedBtn', 'approveVoucherBtn'],
    hold: ['suspendBtn', 'holdVoucherBtn'], reject: ['rejectBtn'],
    refresh: ['refreshBtn', 'refreshAuthorizeBtn', 'refreshOrdersBtn'],
    filter: ['filterBtn'], info: ['infoBtn']
  };
  Object.entries(nativeToolbarActions).forEach(([action, ids]) => {
    ids.forEach((id) => {
      const nativeButton = host.querySelector(`#${id}`);
      if (nativeButton) nativeButton.classList.add('shared-voucher-native-hidden');
    });
  });

  const clickExisting = (...ids) => {
    const target = ids.map((id) => document.getElementById(id))
      .find((element) => element && !element.disabled && !element.closest('[hidden]'));
    if (target) target.click();
    return Boolean(target);
  };

  const listingBodies = ['inventoryTableBody', 'authorizeTableBody', 'piListBody', 'rfqAllBody', 'qrAllBody', 'allPoBody', 'orderTableBody', 'pendingPiBody', 'pendingRfqBody', 'pendingQrBody', 'workflowTableBody'];
  const getRows = () => listingBodies.map((id) => document.getElementById(id))
    .find((body) => body && !body.closest('[hidden]'));
  const selectedRow = () => getRows()?.querySelector('tr.shared-voucher-selected');
  const recordNo = (row) => row?.dataset.docNo
    || row?.dataset.openDoc
    || row?.dataset.openPi && row.cells[2]?.textContent.trim()
    || row?.dataset.openRfq && row.cells[2]?.textContent.trim()
    || row?.dataset.openQr && row.cells[2]?.textContent.trim()
    || row?.dataset.openPoRow && row.cells[1]?.textContent.trim()
    || row?.dataset.openOrder && row.cells[1]?.textContent.trim()
    || '';

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-shared-voucher-action]');
    if (!button) return;
    const action = button.dataset.sharedVoucherAction;
    const body = getRows();
    const row = selectedRow();
    const docNo = recordNo(row) || document.getElementById('docNo')?.value
      || document.getElementById('piVoucherNo')?.value
      || document.getElementById('rfqVoucherNo')?.value
      || document.getElementById('qrVoucherNo')?.value
      || document.getElementById('poNo')?.value || '';

    if (action === 'new') {
      if (!clickExisting('createVoucherBtn', 'newVoucherBtn', 'piNewBtn', 'newOrderBtn', 'newWorkflowBtn')) {
        if (document.getElementById('authorizeTableBody')) window.location.href = 'voucher-create.html';
        else window.alert('New voucher is not available on this page.');
      }
      return;
    }
    if (action === 'save') {
      if (!clickExisting('saveVoucherBtn', 'piSaveBtn', 'rfqSaveBtn', 'qrSaveBtn', 'saveOrderTopBtn', 'saveOrderBtn', 'saveWorkflowBtn')) window.alert('There is no form to save on this page.');
      return;
    }
    if (action === 'print') {
      if (!clickExisting('printVoucherBtn', 'printBtn')) window.print();
      return;
    }
    if (action === 'cancel') {
      if (!clickExisting('piCancelBtn', 'rfqCancelBtn', 'qrCancelBtn', 'cancelOrderBtn')) {
        if (document.getElementById('voucherStatus')) window.location.href = 'inventory.html';
        else window.history.back();
      }
      return;
    }
    if (action === 'refresh') {
      if (!clickExisting('refreshBtn', 'refreshAuthorizeBtn', 'refreshOrdersBtn')) window.location.reload();
      return;
    }
    if (action === 'filter') {
      const poFilters = document.querySelector('.po-list-filters');
      if (poFilters && !document.body.classList.contains('po-form-active')
          && document.getElementById('pendingQrView')?.hidden !== false) {
        const isOpen = poFilters.classList.toggle('is-open');
        button.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) poFilters.querySelector('input, select')?.focus();
        return;
      }
      if (!clickExisting('filterBtn')) {
        const search = document.getElementById('inventorySearch') || document.getElementById('authorizeSearch');
        if (search) search.focus();
        else if (body) {
          const query = window.prompt('Filter visible vouchers by text:');
          if (query !== null) [...body.rows].forEach((item) => { item.hidden = !item.innerText.toLowerCase().includes(query.trim().toLowerCase()); });
        } else window.alert('Filtering is only available on a voucher list.');
      }
      return;
    }
    if (action === 'delete') {
      if (clickExisting('deleteSelectedBtn')) return;
      const storageMap = {
        piListBody: ['ims_pi', 'id'], rfqAllBody: ['ims_rfq', 'id'],
        qrAllBody: ['ims_qr', 'id'], allPoBody: ['ims_purchase_orders', 'id'],
        orderTableBody: ['ims_purchase_orders', 'id'], inventoryTableBody: ['materialRequisitionVouchers', 'docNo'],
        authorizeTableBody: ['materialRequisitionVouchers', 'docNo']
      };
      let entry = Object.entries(storageMap).find(([id]) => body?.id === id);
      let keyValue = entry
        ? entry[1][1] === 'docNo' ? row?.dataset.docNo || row?.dataset.openDoc :
          row?.dataset.openPi || row?.dataset.openRfq || row?.dataset.openQr || row?.dataset.openPoRow || row?.dataset.openOrder
        : '';
      if (!entry) {
        const formRecord = [
          ['materialRequisitionVouchers', 'docNo', 'docNo'],
          ['ims_pi', 'id', 'piVoucherNo', () => IMS.piAll()],
          ['ims_rfq', 'id', 'rfqVoucherNo', () => IMS.rfqAll()],
          ['ims_qr', 'id', 'qrVoucherNo', () => IMS.qrAll()],
          ['ims_purchase_orders', 'id', 'poNo', () => IMS.purchaseOrders()]
        ].find(([, , inputId]) => document.getElementById(inputId)?.value);
        if (formRecord) {
          const [storageKey, keyName, inputId, getList] = formRecord;
          const documentNumber = document.getElementById(inputId).value;
          const currentRecord = getList
            ? getList().find((item) => String(item.no) === String(documentNumber))
            : JSON.parse(localStorage.getItem(storageKey) || '[]').find((item) => String(item[keyName]) === String(documentNumber));
          if (currentRecord) {
            entry = [inputId, [storageKey, keyName]];
            keyValue = currentRecord[keyName];
          }
        }
      }
      if (!entry || !keyValue) return window.alert('Open or select a saved voucher before deleting.');
      const [storageKey, keyName] = entry[1];
      let list;
      try { list = JSON.parse(localStorage.getItem(storageKey) || '[]'); }
      catch { return window.alert('Voucher data could not be read.'); }
      if (!Array.isArray(list)) return window.alert('Voucher data is invalid.');
      const record = list.find((item) => String(item[keyName]) === String(keyValue));
      const linked = storageKey === 'ims_pi' && IMS.rfqAll().some((item) => String(item.piId || '') === String(keyValue) || item.piNo === record?.no)
        || storageKey === 'ims_rfq' && IMS.qrAll().some((item) => String(item.rfqId || '') === String(keyValue) || item.rfqNo === record?.no)
        || storageKey === 'ims_qr' && IMS.purchaseOrders().some((item) => String(item.quotationId || '') === String(keyValue) || item.quotationNo === record?.no)
        || storageKey === 'ims_purchase_orders' && (() => {
          try { return JSON.parse(localStorage.getItem('ims_mrn') || '[]').some((item) => String(item.poId || '') === String(keyValue)); }
          catch { return false; }
        })();
      if (linked) return window.alert('This voucher is linked to a later workflow and cannot be deleted.');
      if (!window.confirm(`Delete voucher ${docNo || keyValue}? This cannot be undone.`)) return;
      localStorage.setItem(storageKey, JSON.stringify(list.filter((item) => String(item[keyName]) !== String(keyValue))));
      window.location.reload();
      return;
    }
    if (action === 'email') {
      const subject = encodeURIComponent(`Voucher ${docNo}`);
      const bodyText = encodeURIComponent(`Please review voucher ${docNo}.`);
      window.location.href = `mailto:?subject=${subject}&body=${bodyText}`;
      return;
    }
    if (action === 'barcode') {
      if (!docNo) return window.alert('Open or select a voucher to copy its number.');
      if (!navigator.clipboard?.writeText) return window.prompt('Copy this voucher number for barcode use:', docNo);
      navigator.clipboard.writeText(docNo).then(
        () => window.alert(`Voucher number copied: ${docNo}`),
        () => window.prompt('Copy this voucher number for barcode use:', docNo)
      );
      return;
    }
    if (action === 'approve' || action === 'hold') {
      if (action === 'approve' && body?.id === 'allPoBody') {
        const targets = [...(body.querySelectorAll('.voucher-select:checked') || [])].map((input) => input.value);
        if (!targets.length && row?.dataset.openPoRow) targets.push(row.dataset.openPoRow);
        if (!targets.length) return window.alert('Select a purchase order to authorize it.');
        if (targets.length > 1) return window.alert('Authorize purchase orders one at a time so bill and warehouse details can be recorded.');
        window.location.href = `material-receipt-note.html?authorizePo=${encodeURIComponent(targets[0])}`;
        return;
      }
      const materialRequisitionForm = Boolean(document.getElementById('docNo')?.value);
      if (!['inventoryTableBody', 'authorizeTableBody'].includes(body?.id) && !materialRequisitionForm) return window.alert(`${action === 'approve' ? 'Approve' : 'Hold'} is available for Material Requisition vouchers.`);
      const checkboxes = [...(body?.querySelectorAll('.voucher-select:checked') || [])];
      const targets = checkboxes.length ? checkboxes.map((input) => input.value) : row?.dataset.docNo ? [row.dataset.docNo] : row?.dataset.openDoc ? [row.dataset.openDoc] : materialRequisitionForm ? [document.getElementById('docNo').value] : [];
      if (!targets.length) return window.alert('Select at least one voucher first.');
      const records = JSON.parse(localStorage.getItem('materialRequisitionVouchers') || '[]');
      records.forEach((record) => {
        if (!targets.includes(record.docNo)) return;
        if (action === 'approve') record.authorizationStatus = 'Approved';
        else record.suspended = !record.suspended;
      });
      localStorage.setItem('materialRequisitionVouchers', JSON.stringify(records));
      window.location.reload();
      return;
    }
    if (action === 'reject') {
      if (!['inventoryTableBody', 'authorizeTableBody'].includes(body?.id)) return window.alert('Reject is available for Material Requisition vouchers.');
      const checkboxes = [...(body?.querySelectorAll('.voucher-select:checked') || [])];
      const targets = checkboxes.length ? checkboxes.map((input) => input.value) : row?.dataset.docNo ? [row.dataset.docNo] : row?.dataset.openDoc ? [row.dataset.openDoc] : [];
      if (!targets.length) return window.alert('Select at least one voucher first.');
      const records = JSON.parse(localStorage.getItem('materialRequisitionVouchers') || '[]');
      records.forEach((record) => { if (targets.includes(record.docNo)) record.authorizationStatus = 'Rejected'; });
      localStorage.setItem('materialRequisitionVouchers', JSON.stringify(records));
      window.location.reload();
      return;
    }
    if (action === 'info') {
      if (!row) return window.alert(docNo ? `Voucher: ${docNo}` : 'Select a voucher row first.');
      window.alert(row.innerText.trim().replace(/\s+/g, ' | '));
      return;
    }
    if (action === 'sort') {
      if (!body) return window.alert('Sorting is available on voucher lists.');
      const rows = [...body.rows].reverse();
      rows.forEach((item) => body.append(item));
      return;
    }
    if (action === 'settings') {
      document.body.classList.toggle('compact-voucher-view');
      return;
    }
    if (action === 'export') {
      const table = body?.closest('table');
      if (!table) return window.alert('Export is available on voucher lists.');
      const csv = [...table.rows].filter((tableRow) => !tableRow.hidden).map((tableRow) => [...tableRow.cells].map((cell) =>
        `"${cell.innerText.replace(/"/g, '""').trim()}"`
      ).join(',')).join('\r\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      link.download = 'vouchers.csv';
      link.click();
      URL.revokeObjectURL(link.href);
      return;
    }
    if (action === 'collapse') {
      const listView = body?.closest('section') || document.querySelector('.inventory-table-wrapper');
      if (listView) listView.classList.toggle('voucher-list-collapsed');
      return;
    }
    if (action === 'clear') {
      body?.querySelectorAll('.shared-voucher-selected, .voucher-select:checked').forEach((item) => {
        item.classList.remove('shared-voucher-selected');
        if (item.matches('input[type="checkbox"]')) item.checked = false;
      });
      const selectAll = document.getElementById('selectAll');
      if (selectAll) selectAll.checked = false;
      const search = document.getElementById('inventorySearch') || document.getElementById('authorizeSearch');
      if (search) { search.value = ''; search.dispatchEvent(new Event('input', { bubbles: true })); }
      if (!search && body) [...body.rows].forEach((item) => { item.hidden = false; });
    }
  });

  document.addEventListener('click', (event) => {
    const poFilters = document.querySelector('.po-list-filters.is-open');
    if (!poFilters || event.target.closest('.po-list-filters, [data-shared-voucher-action="filter"]')) return;
    poFilters.classList.remove('is-open');
    document.querySelector('[data-shared-voucher-action="filter"]')?.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const poFilters = document.querySelector('.po-list-filters.is-open');
    if (!poFilters) return;
    poFilters.classList.remove('is-open');
    document.querySelector('[data-shared-voucher-action="filter"]')?.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('click', (event) => {
    const row = event.target.closest('tbody tr[data-doc-no], tbody tr[data-open-pi], tbody tr[data-open-rfq], tbody tr[data-open-qr], tbody tr[data-open-po-row], tbody tr[data-open-order], tbody tr[data-open-doc]');
    if (!row || event.target.closest('button, input, a')) return;
    row.parentElement.querySelectorAll('.shared-voucher-selected').forEach((selected) => selected.classList.remove('shared-voucher-selected'));
    row.classList.add('shared-voucher-selected');
  });
});
