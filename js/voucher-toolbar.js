document.addEventListener('DOMContentLoaded', () => {
  const listBodies = [
    'inventoryTableBody', 'authorizeTableBody', 'issueAllBody', 'issuePendingBody',
    'piListBody', 'rfqAllBody', 'pendingPiBody', 'qrAllBody', 'pendingRfqBody',
    'allPoBody', 'pendingQrBody', 'orderTableBody', 'mrnAllBody',
    'mrnPendingPoBody', 'workflowTableBody'
  ];
  const deletableLists = {
    inventoryTableBody: { storageKey: 'materialRequisitionVouchers', keyName: 'docNo', rowKey: 'docNo', label: 'material issue voucher' },
    authorizeTableBody: { storageKey: 'materialRequisitionVouchers', keyName: 'docNo', rowKey: 'openDoc', label: 'material issue voucher' },
    issueAllBody: { storageKey: 'materialRequisitionVouchers', keyName: 'docNo', rowKey: 'docNo', label: 'material issue voucher' },
    issuePendingBody: { storageKey: 'materialRequisitionVouchers', keyName: 'docNo', rowKey: 'docNo', label: 'material issue voucher' },
    piListBody: { storageKey: 'ims_pi', keyName: 'id', rowKey: 'openPi', label: 'purchase indent' },
    pendingPiBody: { storageKey: 'ims_pi', keyName: 'id', rowKey: 'openPi', label: 'purchase indent' },
    rfqAllBody: { storageKey: 'ims_rfq', keyName: 'id', rowKey: 'openRfq', label: 'RFQ' },
    pendingRfqBody: { storageKey: 'ims_rfq', keyName: 'id', rowKey: 'openPendingRfq', label: 'RFQ' },
    qrAllBody: { storageKey: 'ims_qr', keyName: 'id', rowKey: 'openQr', label: 'quotation' },
    pendingQrBody: { storageKey: 'ims_qr', keyName: 'id', rowKey: 'openPendingQr', label: 'quotation' },
    allPoBody: { storageKey: 'ims_purchase_orders', keyName: 'id', rowKey: 'openPoRow', label: 'purchase order' },
    orderTableBody: { storageKey: 'ims_purchase_orders', keyName: 'id', rowKey: 'openOrder', label: 'purchase order' },
    mrnAllBody: { storageKey: 'ims_mrn', keyName: 'id', rowKey: 'openMrn', label: 'material receipt note' },
    mrnPendingPoBody: { storageKey: 'ims_purchase_orders', keyName: 'id', rowKey: 'openPendingPo', label: 'purchase order' }
  };
  const deletableForms = [
    { inputId: 'docNo', storageKey: 'materialRequisitionVouchers', keyName: 'docNo', numberKey: 'docNo', label: 'material issue voucher' },
    { inputId: 'piVoucherNo', storageKey: 'ims_pi', keyName: 'id', numberKey: 'no', label: 'purchase indent' },
    { inputId: 'rfqVoucherNo', storageKey: 'ims_rfq', keyName: 'id', numberKey: 'no', label: 'RFQ' },
    { inputId: 'qrVoucherNo', storageKey: 'ims_qr', keyName: 'id', numberKey: 'no', label: 'quotation' },
    { inputId: 'poNo', storageKey: 'ims_purchase_orders', keyName: 'id', numberKey: 'no', label: 'purchase order' },
    { inputId: 'mrnNo', storageKey: 'ims_mrn', keyName: 'id', numberKey: 'no', label: 'material receipt note' }
  ];
  const host = document.querySelector('.inventory-actions, .page-header-tools, .voucher-header .voucher-actions');
  if (!host || host.querySelector('[data-shared-voucher-action]')) return;

  const nativeToolbarActions = {
    new: ['createVoucherBtn', 'newVoucherBtn', 'piNewBtn', 'newOrderBtn', 'newWorkflowBtn'],
    save: ['saveVoucherBtn', 'saveOrderTopBtn', 'piSaveBtn', 'rfqSaveBtn', 'qrSaveBtn', 'saveOrderBtn', 'saveWorkflowBtn'],
    delete: ['deleteSelectedBtn'],
    print: ['printBtn', 'printVoucherBtn'],
    approve: ['authorizeBtn', 'authorizeSelectedBtn', 'approveVoucherBtn'],
    refresh: ['refreshBtn', 'refreshAuthorizeBtn', 'refreshOrdersBtn'],
    filter: ['filterBtn']
  };
  const hasList = listBodies.some((id) => {
    const body = document.getElementById(id);
    return body && !body.closest('[hidden]');
  });
  const hasDeletableList = Object.keys(deletableLists).some((id) => {
    const body = document.getElementById(id);
    return body && !body.closest('[hidden]');
  });
  const hasDeletableForm = deletableForms.some(({ inputId }) => {
    const field = document.getElementById(inputId);
    return field && !field.closest('[hidden]');
  });
  const actions = [
    ['new', 'fa-plus', 'New voucher'],
    ['save', 'fa-floppy-disk', 'Save voucher'],
    ['delete', 'fa-trash-can', 'Delete selected voucher'],
    ['print', 'fa-print', 'Print'],
    ['approve', 'fa-circle-check', 'Authorize selected'],
    ['refresh', 'fa-arrows-rotate', 'Refresh list'],
    ['filter', 'fa-filter', 'Filter or search']
  ].filter(([action]) => {
    if (action === 'delete') return hasDeletableList || hasDeletableForm || nativeToolbarActions.delete.some((id) => host.querySelector(`#${id}`));
    if (action === 'filter') return hasList || nativeToolbarActions.filter.some((id) => host.querySelector(`#${id}`));
    return nativeToolbarActions[action].some((id) => host.querySelector(`#${id}`));
  });
  if (!actions.length) return;

  const bar = document.createElement('div');
  bar.className = 'shared-voucher-toolbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Voucher actions');
  bar.innerHTML = actions.map(([action, icon, label]) =>
    `<button type="button" class="shared-voucher-action" data-shared-voucher-action="${action}" title="${label}" aria-label="${label}"${action === 'filter' ? ' aria-expanded="false"' : ''}><i class="fa-solid ${icon}" aria-hidden="true"></i></button>`
  ).join('');
  if (actions.some(([action]) => action === 'filter') && !nativeToolbarActions.filter.some((id) => host.querySelector(`#${id}`))) {
    const filterPanel = document.createElement('div');
    filterPanel.className = 'shared-voucher-filter-panel filter-modal';
    filterPanel.hidden = true;
    filterPanel.innerHTML = `
      <div class="filter-dialog" role="dialog" aria-modal="true" aria-labelledby="sharedVoucherFilterTitle">
        <div class="filter-dialog-header">
          <div>
            <div id="sharedVoucherFilterTitle" class="filter-title">Filter</div>
            <div class="filter-subtitle">Default Filter</div>
          </div>
          <button type="button" class="filter-close-btn" data-shared-filter-close title="Close filter" aria-label="Close filter">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div class="filter-divider"></div>
        <div class="filter-dialog-body">
          <div class="filter-row">
            <label class="filter-field wide" for="sharedVoucherFilter">
              <span>Filter this list</span>
              <input id="sharedVoucherFilter" type="search" placeholder="Type to filter rows" autocomplete="off">
            </label>
          </div>
          <div class="filter-actions">
            <button type="button" class="page-btn filter-clear-btn" data-shared-filter-clear>Clear</button>
            <button type="button" class="page-btn" data-shared-filter-apply>Ok</button>
            <button type="button" class="page-btn" data-shared-filter-close>Close</button>
          </div>
        </div>
      </div>`;
    bar.append(filterPanel);
  }
  host.prepend(bar);

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

  const getRows = () => listBodies.map((id) => document.getElementById(id))
    .find((body) => body && !body.closest('[hidden]'));
  const selectedRow = () => getRows()?.querySelector('tr.shared-voucher-selected');
  const filterPanel = host.querySelector('.shared-voucher-filter-panel');
  const filterInput = filterPanel?.querySelector('input');
  const setSharedFilterOpen = (isOpen) => {
    if (!filterPanel) return;
    filterPanel.hidden = !isOpen;
    const trigger = host.querySelector('[data-shared-voucher-action="filter"]');
    trigger?.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) filterInput?.focus();
    else trigger?.focus();
  };
  const applyRowFilter = () => {
    const currentBody = getRows();
    const query = (filterInput?.value || '').trim().toLocaleLowerCase();
    currentBody && [...currentBody.rows].forEach((item) => {
      item.hidden = Boolean(query) && !item.innerText.toLocaleLowerCase().includes(query);
      if (item.hidden) {
        item.classList.remove('shared-voucher-selected');
        item.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = false; });
      }
    });
  };
  filterInput?.addEventListener('input', applyRowFilter);
  filterPanel?.querySelector('[data-shared-filter-clear]')?.addEventListener('click', () => {
    if (filterInput) filterInput.value = '';
    applyRowFilter();
    filterInput?.focus();
  });
  filterPanel?.querySelectorAll('[data-shared-filter-close], [data-shared-filter-apply]')
    .forEach((button) => button.addEventListener('click', () => setSharedFilterOpen(false)));
  filterPanel?.addEventListener('click', (event) => {
    if (event.target === filterPanel) setSharedFilterOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && filterPanel && !filterPanel.hidden) setSharedFilterOpen(false);
  });
  const recordNo = (row) => row?.dataset.docNo
    || row?.dataset.openDoc
    || row?.dataset.openPi && row.cells[2]?.textContent.trim()
    || row?.dataset.openRfq && row.cells[2]?.textContent.trim()
    || row?.dataset.openQr && row.cells[2]?.textContent.trim()
    || row?.dataset.openPoRow && row.cells[1]?.textContent.trim()
    || row?.dataset.openOrder && row.cells[1]?.textContent.trim()
    || '';

  document.addEventListener('click', (event) => {
    if (filterPanel && !filterPanel.hidden
        && (event.target === filterPanel || !event.target.closest('.shared-voucher-toolbar'))) {
      setSharedFilterOpen(false);
    }
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
        document.getElementById('togglePoFiltersBtn')?.click();
        const isOpen = !document.getElementById('poFilterPanel')?.hidden;
        button.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) poFilters.querySelector('.po-filter-panel input, .po-filter-panel select')?.focus();
        return;
      }
      if (clickExisting('filterBtn')) {
        const nativeFilterPanel = document.getElementById('filterPanel');
        button.setAttribute('aria-expanded', String(Boolean(nativeFilterPanel && !nativeFilterPanel.classList.contains('hidden'))));
        return;
      }
      const panel = host.querySelector('.shared-voucher-filter-panel');
      if (panel) {
        setSharedFilterOpen(panel.hidden);
        return;
      }
      const search = document.getElementById('inventorySearch') || document.getElementById('authorizeSearch');
      if (search) search.focus();
      else if (!body) window.alert('Filtering is only available on a voucher list.');
      return;
    }
    if (action === 'delete') {
      let config = deletableLists[body?.id];
      const checkedBoxes = body
        ? [...body.querySelectorAll('input[type="checkbox"]:checked')]
          .filter((input) => !['selectAll', 'selectAllAuthorize'].includes(input.id) && !input.closest('tr')?.hidden)
        : [];
      const selectedRows = checkedBoxes.length
        ? checkedBoxes.map((input) => input.closest('tr')).filter(Boolean)
        : body ? [...body.querySelectorAll('tr.shared-voucher-selected:not([hidden])')] : [];
      const targets = new Set(checkedBoxes.map((input) => input.value).filter(Boolean));
      if (config) {
        selectedRows.forEach((selected) => {
          const key = selected.dataset[config.rowKey];
          if (key) targets.add(key);
        });
      } else {
        const formDefinition = deletableForms.find(({ inputId }) => {
          const field = document.getElementById(inputId);
          return field && !field.closest('[hidden]') && field.value.trim();
        });
        if (!formDefinition) return window.alert('Select a saved voucher from the current list before deleting.');
        const number = document.getElementById(formDefinition.inputId).value.trim();
        let formRecords;
        try { formRecords = JSON.parse(localStorage.getItem(formDefinition.storageKey) || '[]'); }
        catch { return window.alert('Voucher data could not be read.'); }
        if (!Array.isArray(formRecords)) return window.alert('Voucher data is invalid.');
        const savedRecord = formRecords.find((item) => String(item?.[formDefinition.numberKey] || '') === number);
        if (!savedRecord) return window.alert('This voucher has not been saved yet.');
        config = formDefinition;
        targets.add(String(savedRecord[config.keyName]));
      }
      if (!config) return window.alert('Select a saved voucher from the current list before deleting.');
      if (!targets.size) return window.alert('Select a voucher row before deleting.');

      let list;
      try { list = JSON.parse(localStorage.getItem(config.storageKey) || '[]'); }
      catch { return window.alert('Voucher data could not be read.'); }
      if (!Array.isArray(list)) return window.alert('Voucher data is invalid.');
      const records = list.filter((item) => targets.has(String(item?.[config.keyName])));
      if (records.length !== targets.size) return window.alert('Some selected vouchers could not be found. Refresh the list and try again.');
      let savedMrns = [];
      if (config.storageKey === 'ims_purchase_orders') {
        try {
          savedMrns = JSON.parse(localStorage.getItem('ims_mrn') || '[]');
          if (!Array.isArray(savedMrns)) throw new TypeError('Saved material receipt notes are invalid.');
        } catch (error) {
          console.error('Could not verify purchase order links before deletion.', error);
          return window.alert('Purchase orders could not be checked for linked material receipts. Nothing was deleted.');
        }
      }
      let linked;
      try {
        linked = records.find((record) =>
          config.storageKey === 'ims_pi' && IMS.rfqAll().some((item) => String(item.piId || '') === String(record.id) || item.piNo === record.no)
          || config.storageKey === 'ims_rfq' && IMS.qrAll().some((item) => String(item.rfqId || '') === String(record.id) || item.rfqNo === record.no)
          || config.storageKey === 'ims_qr' && IMS.purchaseOrders().some((item) => String(item.quotationId || '') === String(record.id) || item.quotationNo === record.no)
          || config.storageKey === 'ims_purchase_orders' && savedMrns.some((item) => String(item.poId || '') === String(record.id))
        );
      } catch (error) {
        console.error('Could not verify voucher links before deletion.', error);
        return window.alert('Voucher links could not be checked. Nothing was deleted.');
      }
      if (linked) return window.alert(`This ${config.label} is linked to a later workflow and cannot be deleted.`);
      const names = records.map((record) => String(record.no || record.docNo || record.id)).join(', ');
      if (!window.confirm(`Delete ${records.length} ${config.label}${records.length === 1 ? '' : 's'} (${names})? This cannot be undone.`)) return;

      if (config.storageKey === 'ims_mrn') {
        const snapshot = ['softManagerItems', 'ims_items', 'ims_mrn', 'ims_purchase_orders']
          .map((key) => [key, localStorage.getItem(key)]);
        try {
          const orders = IMS.purchaseOrders().map((order) => ({ ...order, lines: (order.lines || []).map((line) => ({ ...line })) }));
          records.forEach((note) => {
            const order = orders.find((item) =>
              note.poId && String(item.id) === String(note.poId)
              || !note.poId && note.poNo && String(item.no) === String(note.poNo)
            );
            if (!order && (note.poId || note.poNo)) {
              throw new Error(`Purchase order ${note.poNo || note.poId} was not found.`);
            }
            (note.lines || []).forEach((line) => {
              let quantityToReverse = Number(line.receivedQty) || 0;
              if (!order || quantityToReverse <= 0) return;
              const code = String(line.code || '');
              const preferredIndex = Number(line.poLineIndex);
              const hasPreferredIndex = line.poLineIndex !== null
                && line.poLineIndex !== undefined
                && line.poLineIndex !== ''
                && Number.isInteger(preferredIndex)
                && preferredIndex >= 0;
              if (!code && !hasPreferredIndex) {
                throw new Error(`Item details are missing for a received line in purchase order ${order.no || order.id}.`);
              }
              const candidates = order.lines.map((poLine, index) => index).filter((index) => {
                const poLine = order.lines[index];
                const codeMatches = !code || String(poLine.code || poLine.itemCode || '') === code;
                return codeMatches;
              });
              const orderedCandidates = hasPreferredIndex && candidates.includes(preferredIndex)
                ? [preferredIndex, ...candidates.filter((index) => index !== preferredIndex)]
                : candidates;
              for (const index of orderedCandidates) {
                const poLine = order.lines[index];
                const received = Number(poLine.receivedQty) || 0;
                const amount = Math.min(received, quantityToReverse);
                poLine.receivedQty = received - amount;
                quantityToReverse -= amount;
                if (quantityToReverse <= 0) break;
              }
              if (quantityToReverse > 0) {
                throw new Error(`Purchase order ${order.no || order.id} does not contain the received quantity for item ${code || line.name || 'unknown'}.`);
              }
            });
          });
          const ordersToSave = orders.map((order) => {
            const received = order.lines.reduce((sum, line) => sum + (Number(line.receivedQty) || 0), 0);
            const complete = order.lines.every((line) => (Number(line.qty) || 0) - (Number(line.receivedQty) || 0) <= 0);
            return {
              ...order,
              receiptStatus: complete ? 'Received' : received > 0 ? 'Partially Received' : 'Pending Receipt'
            };
          });
          let updatedItems;
          if (records.some((note) => note.stockPosted === true)) {
            const items = IMS.items();
            const reversed = new Map();
            records.filter((note) => note.stockPosted === true).forEach((note) => {
              (note.lines || []).forEach((line) => {
                const quantity = Number(line.receivedQty) || 0;
                if (quantity <= 0) return;
                const code = String(line.code || '');
                if (!code) throw new Error(`Item code is missing for ${line.name || 'a received item'}.`);
                reversed.set(code, (reversed.get(code) || 0) + quantity);
              });
            });
            for (const code of reversed.keys()) {
              const item = items.find((entry) => String(entry.code) === code);
              if (!item) throw new Error(`Item ${code} was not found in Item Master.`);
              if ((Number(item.stock) || 0) < reversed.get(code)) {
                throw new Error(`There is not enough current stock for item ${code} to reverse this receipt.`);
              }
            }
            updatedItems = items.map((item) => ({
              ...item,
              stock: (Number(item.stock) || 0) - (reversed.get(String(item.code)) || 0)
            }));
          }
          localStorage.setItem('ims_purchase_orders', JSON.stringify(ordersToSave));
          if (updatedItems) {
            localStorage.setItem('softManagerItems', JSON.stringify(updatedItems));
            localStorage.setItem('ims_items', JSON.stringify(updatedItems));
          }
          localStorage.setItem(config.storageKey, JSON.stringify(list.filter((item) => !targets.has(String(item?.[config.keyName])))));
        } catch (error) {
          snapshot.forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
          console.error('Could not delete the selected material receipt notes or reverse their purchase order quantities.', error);
          return window.alert(`Material receipt note could not be deleted: ${error.message}`);
        }
      } else {
        try {
          localStorage.setItem(config.storageKey, JSON.stringify(list.filter((item) => !targets.has(String(item?.[config.keyName])))));
        } catch (error) {
          console.error(`Could not delete the selected ${config.label} records.`, error);
          return window.alert('Selected vouchers could not be deleted. Please check browser storage and try again.');
        }
      }
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
      if (!['inventoryTableBody', 'authorizeTableBody'].includes(body?.id) && !materialRequisitionForm) return window.alert(`${action === 'approve' ? 'Approve' : 'Hold'} is available for Material Issue vouchers.`);
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
      if (!['inventoryTableBody', 'authorizeTableBody'].includes(body?.id)) return window.alert('Reject is available for Material Issue vouchers.');
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
    if (filterPanel && !filterPanel.hidden) {
      filterPanel.hidden = true;
      host.querySelector('[data-shared-voucher-action="filter"]')?.setAttribute('aria-expanded', 'false');
      return;
    }
    const poFilters = document.querySelector('.po-list-filters.is-open');
    if (!poFilters) return;
    poFilters.classList.remove('is-open');
    document.querySelector('[data-shared-voucher-action="filter"]')?.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('click', (event) => {
    const row = event.target.closest(listBodies.map((id) => `tbody#${id} > tr`).join(','));
    if (!row || event.target.closest('button, input, a')) return;
    row.parentElement.querySelectorAll('.shared-voucher-selected').forEach((selected) => selected.classList.remove('shared-voucher-selected'));
    row.classList.add('shared-voucher-selected');
  });
});
