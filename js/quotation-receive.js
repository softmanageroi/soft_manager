document.addEventListener('DOMContentLoaded', function () {
  const requiredIds = ['tabAllQr', 'tabPendingRfq', 'qrAllView', 'qrPendingView', 'qrFormView', 'qrAllBody', 'pendingRfqBody', 'qrCount', 'qrVoucherNo', 'qrDate', 'qrRfqNo', 'qrSupplier', 'qrTaxType', 'qrLinesBody', 'qrGrandTotal', 'qrSaveBtn', 'qrCancelBtn', 'qrMessage'];
  const el = {};
  requiredIds.forEach((id) => {
    el[id] = document.getElementById(id);
    if (!el[id]) console.warn(`Quotation Receive: missing #${id}`);
  });
  if (requiredIds.some((id) => !el[id])) return;

  let selectedRfqId = null;
  let editingQrId = null;
  let activeTab = 'all';
  let vendors = [];
  let vendorLoadError = '';
  let contextRow = null;
  let extraRowCounter = 0;
  const pendingItemChoices = new Map();
  const esc = IMS.esc;

  function loadVendors() {
    try {
      const storedAccounts = localStorage.getItem('softManagerAccounts');
      const accounts = storedAccounts ? JSON.parse(storedAccounts) : [];
      if (!Array.isArray(accounts)) throw new Error('Saved account data must be a list.');
      vendors = accounts.filter((account) =>
        account && typeof account === 'object'
        && (!account.type || account.type === 'Vendor')
        && typeof account.name === 'string'
        && account.name.trim()
      );
      el.qrSupplier.innerHTML = '<option value="">Select default vendor</option>' + vendors.map((vendor) =>
        `<option value="${esc(vendor.name.trim())}">${esc(vendor.name.trim())}</option>`
      ).join('');
    } catch (error) {
      vendorLoadError = `Could not load vendor accounts: ${error.message}`;
      console.error('Quotation Receive: could not load vendor accounts.', error);
    }
  }

  function message(text, error) {
    el.qrMessage.textContent = text;
    el.qrMessage.classList.toggle('error', Boolean(error));
  }

  function hideItemContextMenu() {
    const menu = document.getElementById('qrItemContextMenu');
    if (menu) menu.hidden = true;
    contextRow = null;
  }

  function updatePendingItemOptions() {
    const options = document.getElementById('qrPendingItemOptions');
    pendingItemChoices.clear();
    const rows = [];
    IMS.rfqAll().forEach((rfq) => {
      if (String(rfq.id) === String(selectedRfqId) || rfqStatus(rfq) === 'Closed') return;
      (rfq.lines || []).forEach((line, index) => {
        const balance = Math.max(0, (Number(line.qty) || 0) - (Number(line.consumed) || 0));
        if (balance <= 0) return;
        const label = `${line.name || line.itemName || 'Item'} (${line.code || ''}) — ${rfq.no} — balance ${balance} — line ${index + 1}`;
        pendingItemChoices.set(label, { rfq, line, index, balance });
        rows.push(`<option value="${esc(label)}"></option>`);
      });
    });
    options.innerHTML = rows.join('');
  }

  function insertPendingItemRow(afterRow, focus = true) {
    const row = document.createElement('tr');
    const index = 100000 + extraRowCounter++;
    row.dataset.qrExtraRow = 'true';
    row.dataset.qrIndex = String(index);
    row.title = 'Type an item and choose a matching pending RFQ';
    row.innerHTML = `<td></td><td></td><td><input class="ims-lines-input" type="text" list="qrPendingItemOptions" data-qr-pending-search="true" placeholder="Type item name" aria-label="Find item in pending RFQs"></td>
      <td></td><td></td><td></td><td>0</td>
      <td><input class="ims-lines-input" type="number" min="0" step="any" value="0" data-qr-qty="${index}" aria-label="Received quantity for added item"></td>
      <td><input class="ims-lines-input" type="number" min="0" step="any" value="0" data-qr-rate="${index}" aria-label="Rate for added item"></td>
      <td><input class="ims-lines-input" type="number" min="0" max="100" step="any" value="0" data-qr-gst-rate="${index}" aria-label="GST percentage for added item"></td>
      <td><input class="ims-lines-input" type="number" min="0" step="0.01" value="0" data-qr-cgst="${index}" readonly></td>
      <td><input class="ims-lines-input" type="number" min="0" step="0.01" value="0" data-qr-sgst="${index}" readonly></td>
      <td><input class="ims-lines-input" type="number" min="0" step="0.01" value="0" data-qr-igst="${index}" readonly></td>
      <td data-qr-taxable="${index}">0.00</td>`;
    afterRow.after(row);
    updatePendingItemOptions();
    if (focus) row.querySelector('[data-qr-pending-search]').focus();
  }

  function rfqStatus(rfq) {
    return IMS.rfqStatus(rfq);
  }

  function showTab(tab) {
    activeTab = tab;
    el.tabAllQr.classList.toggle('active', tab === 'all');
    el.tabPendingRfq.classList.toggle('active', tab === 'pending');
    el.qrAllView.hidden = tab !== 'all';
    el.qrPendingView.hidden = tab !== 'pending';
    el.qrFormView.hidden = true;
  }

  function render() {
    const vouchers = IMS.qrAll().slice().reverse();
    el.qrAllBody.innerHTML = vouchers.length ? vouchers.map((qr, index) => `
      <tr data-open-qr="${esc(qr.id)}"><td>${vouchers.length - index}</td><td>${esc(IMS.fmtDate(qr.date))}</td>
      <td>${esc(qr.no)}</td><td>${esc(qr.rfqNo)}</td><td>${esc(qr.supplier)}</td>
      <td>${(Number(qr.total) || 0).toFixed(2)}</td><td>${esc(qr.linkStatus || 'Pending')}</td>
      <td><button class="action-btn has-label" type="button" data-open-qr-button="${esc(qr.id)}">Open</button></td>
      </tr>
    `).join('') : '<tr><td colspan="8">No quotation receive vouchers yet.</td></tr>';
    el.qrCount.textContent = String(vouchers.length);

    const pending = IMS.rfqAll().filter((rfq) => rfqStatus(rfq) !== 'Closed');
    el.pendingRfqBody.innerHTML = pending.length ? pending.map((rfq, index) => `
      <tr data-open-pending-rfq="${esc(rfq.id)}"><td>${index + 1}</td><td>${esc(IMS.fmtDate(rfq.date))}</td><td>${esc(rfq.no)}</td>
      <td>${(rfq.lines || []).filter((line) => Math.max(0, Number(line.qty) - Number(line.consumed || 0)) > 0).length}</td><td>${esc(rfqStatus(rfq))}</td>
      <td><button class="action-btn has-label" type="button" data-receive-quotation="${esc(rfq.id)}">Receive</button></td></tr>
    `).join('') : '<tr><td colspan="6">No pending RFQs.</td></tr>';
  }

  function updateTotal() {
    let total = 0;
    el.qrLinesBody.querySelectorAll('[data-qr-qty]').forEach((input) => {
      const index = Number(input.dataset.qrQty);
      const rateInput = el.qrLinesBody.querySelector(`[data-qr-rate="${index}"]`);
      const taxableAmount = Math.max(0, Number(input.value) || 0) * Math.max(0, Number(rateInput.value) || 0);
      const gstRate = Math.max(0, Number(el.qrLinesBody.querySelector(`[data-qr-gst-rate="${index}"]`)?.value) || 0);
      const taxAmount = taxableAmount * gstRate / 100;
      const tax = el.qrTaxType.value === 'inter'
        ? { cgst: 0, sgst: 0, igst: taxAmount }
        : { cgst: taxAmount / 2, sgst: taxAmount / 2, igst: 0 };
      ['cgst', 'sgst', 'igst'].forEach((taxName) => {
        const taxInput = el.qrLinesBody.querySelector(`[data-qr-${taxName}="${index}"]`);
        if (taxInput) taxInput.value = tax[taxName].toFixed(2);
      });
      const cgstInput = el.qrLinesBody.querySelector(`[data-qr-cgst="${index}"]`);
      const sgstInput = el.qrLinesBody.querySelector(`[data-qr-sgst="${index}"]`);
      const igstInput = el.qrLinesBody.querySelector(`[data-qr-igst="${index}"]`);
      const cgst = Math.max(0, Number(cgstInput.value) || 0);
      const sgst = Math.max(0, Number(sgstInput.value) || 0);
      const igst = Math.max(0, Number(igstInput.value) || 0);
      el.qrLinesBody.querySelector(`[data-qr-taxable="${index}"]`).textContent = taxableAmount.toFixed(2);
      total += taxableAmount + cgst + sgst + igst;
    });
    el.qrGrandTotal.value = total.toFixed(2);
  }

  function updateTaxInputs() {
    el.qrLinesBody.querySelectorAll('[data-qr-cgst], [data-qr-sgst], [data-qr-igst]').forEach((input) => {
      const isIgst = input.hasAttribute('data-qr-igst');
      const isEnabled = el.qrTaxType.value === 'inter' ? isIgst : !isIgst;
      input.disabled = !isEnabled;
      if (!isEnabled) input.value = '0';
    });
    updateTotal();
  }

  function openForm(rfqId, savedQr = null) {
    const rfqList = IMS.rfqAll();
    const rfq = rfqList.find((entry) => String(entry.id) === String(rfqId))
      || (savedQr ? rfqList.find((entry) => String(entry.no || '') === String(savedQr.rfqNo || '')) : null);
    if (!rfq) return message('RFQ not found.', true);
    selectedRfqId = rfq.id;
    updatePendingItemOptions();
    editingQrId = savedQr?.id || null;
    const date = savedQr?.date || IMS.todayISO();
    el.qrDate.value = date;
    el.qrVoucherNo.value = savedQr?.no || IMS.peekNo('QRU', date);
    el.qrRfqNo.value = rfq.no;
    el.qrTaxType.value = savedQr?.taxType === 'inter' ? 'inter' : 'intra';
    const existingSupplier = savedQr?.supplier || rfq.supplier || '';
    if (existingSupplier && ![...el.qrSupplier.options].some((option) => option.value === existingSupplier)) {
      el.qrSupplier.add(new Option(existingSupplier, existingSupplier));
    }
    el.qrSupplier.value = existingSupplier;
    extraRowCounter = 0;
    el.qrLinesBody.innerHTML = (rfq.lines || []).map((line, index) => {
      const savedLine = savedQr?.lines?.find((entry) => entry.code === line.code && String(entry.sourceRfqId || savedQr.rfqId) === String(rfq.id));
      const previousQty = Number(savedLine?.qty) || 0;
      const item = IMS.items().find((entry) => String(entry.code) === String(line.code));
      const currentStock = item?.stock ?? line.stock;
      const taxableAmount = Number(savedLine?.taxableAmount ?? (previousQty * (Number(savedLine?.rate) || 0)));
      const gstRate = Number(savedLine?.gstRate ?? item?.gst) || 0;
      const legacyTax = taxableAmount * (Number(savedLine?.gstRate ?? item?.gst) || 0) / 100;
      const savedCgst = Number(savedLine?.cgst ?? (savedQr?.taxType === 'inter' ? 0 : legacyTax / 2)) || 0;
      const savedSgst = Number(savedLine?.sgst ?? (savedQr?.taxType === 'inter' ? 0 : legacyTax / 2)) || 0;
      const savedIgst = Number(savedLine?.igst ?? (savedQr?.taxType === 'inter' ? legacyTax : 0)) || 0;
      const balance = Math.max(0, Number(line.qty) - Number(line.consumed || 0) + previousQty);
      if (!savedQr && balance <= 0) return '';
      return `<tr data-qr-line-index="${index}" title="Right-click to remove this item from the quotation"><td>${esc(line.category)}</td><td>${esc(line.brand)}</td>
        <td>${esc(line.name)} (${esc(line.code)})</td><td>${esc(line.description)}</td><td>${esc(line.unit)}</td>
        <td>${esc(currentStock)}</td><td>${balance}</td>
        <td><input class="ims-lines-input" type="number" min="0" max="${balance}" step="any" value="${savedQr ? previousQty : balance}" data-qr-qty="${index}" aria-label="Received quantity for ${esc(line.name)}"></td>
        <td><input class="ims-lines-input" type="number" min="0" step="any" value="${Number(savedLine?.rate) || 0}" data-qr-rate="${index}" aria-label="Rate for ${esc(line.name)}"></td>
        <td><input class="ims-lines-input" type="number" min="0" max="100" step="any" value="${gstRate}" data-qr-gst-rate="${index}" aria-label="GST percentage for ${esc(line.name)}"></td>
        <td><input class="ims-lines-input" type="number" min="0" step="0.01" value="${savedCgst}" data-qr-cgst="${index}" aria-label="CGST amount for ${esc(line.name)}" readonly></td>
        <td><input class="ims-lines-input" type="number" min="0" step="0.01" value="${savedSgst}" data-qr-sgst="${index}" aria-label="SGST amount for ${esc(line.name)}" readonly></td>
        <td><input class="ims-lines-input" type="number" min="0" step="0.01" value="${savedIgst}" data-qr-igst="${index}" aria-label="IGST amount for ${esc(line.name)}" readonly></td>
        <td data-qr-taxable="${index}">${taxableAmount.toFixed(2)}</td></tr>`;
    }).join('');
    if (savedQr) {
      savedQr.lines.filter((line) => String(line.sourceRfqId || savedQr.rfqId) !== String(rfq.id)).forEach((savedLine) => {
        const source = rfqList.find((entry) => String(entry.id) === String(savedLine.sourceRfqId));
        const sourceIndex = Number(savedLine.sourceLineIndex);
        const sourceLine = source?.lines?.[sourceIndex] || savedLine;
        const index = 100000 + extraRowCounter++;
        const balance = Math.max(0, Number(sourceLine.qty || savedLine.qty) - Number(sourceLine.consumed || 0) + (Number(savedLine.qty) || 0));
        const taxable = Number(savedLine.taxableAmount ?? (Number(savedLine.qty) * Number(savedLine.rate)));
        const label = `${savedLine.name || sourceLine.name || 'Item'} (${savedLine.code || ''}) — ${savedLine.sourceRfqNo || source?.no || ''}`;
        const item = IMS.items().find((entry) => String(entry.code) === String(savedLine.code));
        const currentStock = item?.stock ?? sourceLine.stock ?? savedLine.stock ?? 0;
        el.qrLinesBody.insertAdjacentHTML('beforeend', `<tr data-qr-extra-row="true" data-qr-index="${index}" data-source-rfq-id="${esc(savedLine.sourceRfqId || '')}" data-source-line-index="${sourceIndex}" data-source-rfq-no="${esc(savedLine.sourceRfqNo || source?.no || '')}" data-line="${esc(JSON.stringify(sourceLine))}" title="Right-click to remove this item from the quotation"><td>${esc(savedLine.category || '')}</td><td>${esc(savedLine.brand || '')}</td><td><input class="ims-lines-input" type="text" list="qrPendingItemOptions" data-qr-pending-search="true" value="${esc(label)}" aria-label="Selected pending RFQ item"></td><td>${esc(savedLine.description || '')}</td><td>${esc(savedLine.unit || '')}</td><td>${esc(currentStock)}</td><td>${balance}</td><td><input class="ims-lines-input" type="number" min="0" max="${balance}" step="any" value="${Number(savedLine.qty) || 0}" data-qr-qty="${index}"></td><td><input class="ims-lines-input" type="number" min="0" step="any" value="${Number(savedLine.rate) || 0}" data-qr-rate="${index}"></td><td><input class="ims-lines-input" type="number" min="0" max="100" step="any" value="${Number(savedLine.gstRate ?? item?.gst) || 0}" data-qr-gst-rate="${index}"></td><td><input class="ims-lines-input" type="number" min="0" step="0.01" value="${Number(savedLine.cgst) || 0}" data-qr-cgst="${index}" readonly></td><td><input class="ims-lines-input" type="number" min="0" step="0.01" value="${Number(savedLine.sgst) || 0}" data-qr-sgst="${index}" readonly></td><td><input class="ims-lines-input" type="number" min="0" step="0.01" value="${Number(savedLine.igst) || 0}" data-qr-igst="${index}" readonly></td><td data-qr-taxable="${index}">${taxable.toFixed(2)}</td></tr>`);
      });
    }
    while (el.qrLinesBody.rows.length < 5) {
      insertPendingItemRow(el.qrLinesBody.lastElementChild, false);
    }
    el.qrAllView.hidden = true;
    el.qrPendingView.hidden = true;
    el.qrFormView.hidden = false;
    el.qrSaveBtn.disabled = false;
    el.qrSaveBtn.title = '';
    message('', false);
    updateTaxInputs();
  }

  el.tabAllQr.addEventListener('click', () => showTab('all'));
  el.tabPendingRfq.addEventListener('click', () => showTab('pending'));
  el.qrAllBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-qr-button]');
    if (!button) return;
    const qr = IMS.qrAll().find((entry) => String(entry.id) === button.dataset.openQrButton);
    if (qr) openForm(qr.rfqId, qr);
  });
  el.pendingRfqBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-receive-quotation]');
    if (button) openForm(button.dataset.receiveQuotation);
  });
  el.pendingRfqBody.addEventListener('dblclick', (event) => {
    const row = event.target.closest('[data-open-pending-rfq]');
    if (!row) return;
    openForm(row.dataset.openPendingRfq);
  });
  el.qrLinesBody.addEventListener('contextmenu', (event) => {
    const row = event.target.closest('[data-qr-line-index], [data-qr-extra-row]');
    if (!row) return;
    event.preventDefault();
    contextRow = row;
    const menu = document.getElementById('qrItemContextMenu');
    menu.hidden = false;
    const left = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8);
    const top = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
  });
  document.getElementById('removeQrItemBtn').addEventListener('click', () => {
    if (!contextRow) return;
    const itemName = contextRow.querySelector('td:nth-child(3)')?.textContent.trim() || 'Item';
    contextRow.remove();
    hideItemContextMenu();
    updateTotal();
    message(`${itemName} removed from this quotation. It will remain pending in RFQ.`, false);
  });
  document.getElementById('insertQrItemBtn').addEventListener('click', () => {
    if (!contextRow) return;
    const row = contextRow;
    hideItemContextMenu();
    insertPendingItemRow(row);
  });
  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (!event.target.closest('#qrItemContextMenu')) hideItemContextMenu();
  });
  window.addEventListener('scroll', hideItemContextMenu, true);
  el.qrAllBody.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    const row = event.target.closest('[data-open-qr]');
    if (!row) return;
    const qr = IMS.qrAll().find((entry) => String(entry.id) === row.dataset.openQr);
    if (qr) openForm(qr.rfqId, qr);
  });
  el.qrLinesBody.addEventListener('input', updateTotal);
  el.qrLinesBody.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || event.shiftKey || !event.target.matches('input')) return;
    const row = event.target.closest('tr');
    const rowInputs = [...row.querySelectorAll('input')];
    if (row !== el.qrLinesBody.lastElementChild || event.target !== rowInputs.at(-1)) return;
    event.preventDefault();
    insertPendingItemRow(row);
  });
  el.qrLinesBody.addEventListener('change', (event) => {
    if (!event.target.matches('[data-qr-pending-search]')) return;
    const row = event.target.closest('[data-qr-extra-row]');
    const choice = pendingItemChoices.get(event.target.value);
    if (!row || !choice) {
      if (row) {
        row.dataset.sourceRfqId = '';
        row.dataset.sourceLineIndex = '';
        row.dataset.line = '';
      }
      return message('Choose an item from the pending RFQ suggestions.', true);
    }
    const { rfq, line, index: sourceIndex, balance } = choice;
    const rowIndex = row.dataset.qrIndex;
    const item = IMS.items().find((entry) => String(entry.code) === String(line.code));
    row.dataset.sourceRfqId = String(rfq.id);
    row.dataset.sourceLineIndex = String(sourceIndex);
    row.dataset.sourceRfqNo = String(rfq.no || '');
    row.dataset.line = JSON.stringify(line);
    row.cells[0].textContent = line.category || '';
    row.cells[1].textContent = line.brand || '';
    event.target.value = `${line.name || line.itemName || 'Item'} (${line.code || ''}) — ${rfq.no}`;
    row.cells[3].textContent = line.description || '';
    row.cells[4].textContent = line.unit || '';
    row.cells[5].textContent = String(item?.stock ?? line.stock ?? 0);
    row.cells[6].textContent = String(balance);
    row.querySelector(`[data-qr-qty="${rowIndex}"]`).value = String(balance);
    row.querySelector(`[data-qr-qty="${rowIndex}"]`).max = String(balance);
    row.querySelector(`[data-qr-gst-rate="${rowIndex}"]`).value = String(Number(item?.gst) || 0);
    message('', false);
    updateTotal();
  });
  el.qrTaxType.addEventListener('change', updateTaxInputs);
  el.qrDate.addEventListener('change', () => {
    if (!editingQrId) el.qrVoucherNo.value = IMS.peekNo('QRU', el.qrDate.value);
  });
  el.qrCancelBtn.addEventListener('click', () => {
    selectedRfqId = null;
    editingQrId = null;
    message('', false);
    showTab(activeTab);
  });
  el.qrSaveBtn.addEventListener('click', () => {
    if (editingQrId && IMS.purchaseOrders().some((order) =>
      String(order.quotationId || '') === String(editingQrId)
      || String(order.quotationNo || '') === String(el.qrVoucherNo.value)
    )) {
      return message('This quotation is linked to a Purchase Order and cannot be changed.', true);
    }
    const rfqList = IMS.rfqAll();
    const rfq = rfqList.find((entry) => String(entry.id) === String(selectedRfqId));
    if (!rfq) return message('RFQ not found.', true);
    const oldQr = editingQrId
      ? IMS.qrAll().find((entry) => String(entry.id) === String(editingQrId))
      : null;
    if (editingQrId && !oldQr) return message('This Quotation Receive no longer exists. Refresh the voucher list and try again.', true);
    const supplier = el.qrSupplier.value.trim();
    if (!supplier) return message('Supplier is required.', true);
    if (vendorLoadError) return message(`${vendorLoadError}. Add a vendor in Account Master before saving.`, true);
    const selectedVendor = vendors.find((vendor) => vendor.name.trim().toLowerCase() === supplier.toLowerCase());
    if (!selectedVendor) return message('Select a supplier saved as Vendor in Account Master.', true);
    if (!String(selectedVendor.gstin || '').trim()) {
      return message('Supplier GSTIN is missing. Add GSTIN in Account Master before saving this quotation.', true);
    }
    if (!el.qrDate.value) return message('Please select a date.', true);
    const oldQuantities = new Map();
    (oldQr?.lines || []).forEach((line) => {
      const sourceId = String(line.sourceRfqId || oldQr.rfqId);
      const sourceIndex = Number.isInteger(Number(line.sourceLineIndex)) ? Number(line.sourceLineIndex) : -1;
      const key = `${sourceId}:${sourceIndex >= 0 ? sourceIndex : line.code}`;
      oldQuantities.set(key, (oldQuantities.get(key) || 0) + (Number(line.qty) || 0));
    });
    const lines = [];
    let total = 0;
    for (let index = 0; index < (rfq.lines || []).length; index += 1) {
      const line = rfq.lines[index];
      const balance = Math.max(0, Number(line.qty) - Number(line.consumed || 0) + (oldQuantities.get(`${rfq.id}:${index}`) || oldQuantities.get(`${rfq.id}:${line.code}`) || 0));
      const qtyInput = el.qrLinesBody.querySelector(`[data-qr-qty="${index}"]`);
      const rateInput = el.qrLinesBody.querySelector(`[data-qr-rate="${index}"]`);
      const gstRate = Number(el.qrLinesBody.querySelector(`[data-qr-gst-rate="${index}"]`)?.value);
      const cgstInput = el.qrLinesBody.querySelector(`[data-qr-cgst="${index}"]`);
      const sgstInput = el.qrLinesBody.querySelector(`[data-qr-sgst="${index}"]`);
      const igstInput = el.qrLinesBody.querySelector(`[data-qr-igst="${index}"]`);
      if (!qtyInput) continue;
      const qty = Number(qtyInput && qtyInput.value);
      const rate = Number(rateInput && rateInput.value);
      const cgst = Number(cgstInput && cgstInput.value);
      const sgst = Number(sgstInput && sgstInput.value);
      const igst = Number(igstInput && igstInput.value);
      if (!Number.isFinite(qty) || qty < 0 || qty > balance) {
        return message('Received quantity must be between zero and the RFQ balance.', true);
      }
      if (!Number.isFinite(rate) || rate < 0) return message('Rate must be zero or greater.', true);
      if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) return message('GST percentage must be between 0 and 100.', true);
      if (![cgst, sgst, igst].every((amount) => Number.isFinite(amount) && amount >= 0)) {
        return message('GST amounts must be zero or greater.', true);
      }
      if (el.qrTaxType.value === 'intra' && igst !== 0) return message('Enter CGST and SGST only for CGST + SGST GST type.', true);
      if (el.qrTaxType.value === 'inter' && (cgst !== 0 || sgst !== 0)) return message('Enter IGST only for IGST type.', true);
      if (qty > 0) {
        const gstAmount = el.qrTaxType.value === 'inter' ? igst : cgst + sgst;
        if (gstAmount <= 0) {
          return message(`Enter a GST amount greater than zero for ${line.name}.`, true);
        }
        const taxableAmount = qty * rate;
        const amount = taxableAmount + cgst + sgst + igst;
        lines.push({ ...line, qty, rate, gstRate, taxableAmount, cgst, sgst, igst, amount, consumed: 0, sourceRfqId: rfq.id, sourceRfqNo: rfq.no, sourceLineIndex: index });
        total += amount;
      }
    }
    for (const row of el.qrLinesBody.querySelectorAll('[data-qr-extra-row]')) {
      const search = row.querySelector('[data-qr-pending-search]');
      if (!row.dataset.sourceRfqId) {
        if (search?.value.trim()) return message('Choose an item from the pending RFQ suggestions.', true);
        continue;
      }
      const source = rfqList.find((entry) => String(entry.id) === String(row.dataset.sourceRfqId));
      const sourceIndex = Number(row.dataset.sourceLineIndex);
      const line = source?.lines?.[sourceIndex];
      if (!source || !line) return message('The selected pending RFQ item no longer exists. Choose it again.', true);
      const qty = Number(row.querySelector('[data-qr-qty]').value);
      const rate = Number(row.querySelector('[data-qr-rate]').value);
      const gstRate = Number(row.querySelector('[data-qr-gst-rate]').value);
      const cgst = Number(row.querySelector('[data-qr-cgst]').value);
      const sgst = Number(row.querySelector('[data-qr-sgst]').value);
      const igst = Number(row.querySelector('[data-qr-igst]').value);
      const balance = Math.max(0, Number(line.qty) - Number(line.consumed || 0) + (oldQuantities.get(`${source.id}:${sourceIndex}`) || oldQuantities.get(`${source.id}:${line.code}`) || 0));
      if (!Number.isFinite(qty) || qty < 0 || qty > balance) return message(`Received quantity for ${line.name} must be between zero and its pending RFQ balance.`, true);
      if (!Number.isFinite(rate) || rate < 0) return message('Rate must be zero or greater.', true);
      if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) return message('GST percentage must be between 0 and 100.', true);
      if (![cgst, sgst, igst].every((amount) => Number.isFinite(amount) && amount >= 0)) return message('GST amounts must be zero or greater.', true);
      if (el.qrTaxType.value === 'intra' && igst !== 0) return message('Enter CGST and SGST only for CGST + SGST GST type.', true);
      if (el.qrTaxType.value === 'inter' && (cgst !== 0 || sgst !== 0)) return message('Enter IGST only for IGST type.', true);
      if (qty > 0) {
        const gstAmount = el.qrTaxType.value === 'inter' ? igst : cgst + sgst;
        if (gstAmount <= 0) return message(`Enter a GST amount greater than zero for ${line.name}.`, true);
        const taxableAmount = qty * rate;
        const amount = taxableAmount + cgst + sgst + igst;
        lines.push({ ...line, qty, rate, gstRate, taxableAmount, cgst, sgst, igst, amount, consumed: 0, sourceRfqId: source.id, sourceRfqNo: source.no, sourceLineIndex: sourceIndex });
        total += amount;
      }
    }
    if (!lines.length) return message('Enter a received quantity greater than zero for at least one item.', true);
    const date = el.qrDate.value;
    const voucher = {
      id: oldQr?.id || IMS.uid(),
      no: oldQr?.no || IMS.nextNo('QRU', date),
      date,
      rfqId: rfq.id,
      rfqNo: rfq.no,
      supplier: selectedVendor.name.trim(),
      taxType: el.qrTaxType.value,
      lines,
      total,
      linkStatus: 'Pending'
    };
    const updatedRfqs = rfqList.map((entry) => ({ ...entry, lines: (entry.lines || []).map((line) => ({ ...line })) }));
    const adjustConsumed = (entry, lineIndex, amount) => {
      if (!entry || !entry.lines?.[lineIndex]) return;
      entry.lines[lineIndex].consumed = Math.max(0, (Number(entry.lines[lineIndex].consumed) || 0) + amount);
    };
    (oldQr?.lines || []).forEach((line) => {
      const sourceId = String(line.sourceRfqId || oldQr.rfqId);
      const source = updatedRfqs.find((entry) => String(entry.id) === sourceId);
      let sourceIndex = Number(line.sourceLineIndex);
      if (!Number.isInteger(sourceIndex) || sourceIndex < 0) sourceIndex = source?.lines?.findIndex((entry) => String(entry.code) === String(line.code)) ?? -1;
      adjustConsumed(source, sourceIndex, -(Number(line.qty) || 0));
    });
    lines.forEach((line) => {
      const source = updatedRfqs.find((entry) => String(entry.id) === String(line.sourceRfqId || rfq.id));
      adjustConsumed(source, Number(line.sourceLineIndex), Number(line.qty) || 0);
    });
    updatedRfqs.forEach((entry) => { entry.linkStatus = rfqStatus(entry); });
    IMS.rfqSave(updatedRfqs);
    const qrList = IMS.qrAll();
    IMS.qrSave(oldQr
      ? qrList.map((entry) => String(entry.id) === String(oldQr.id) ? voucher : entry)
      : [...qrList, voucher]);
    selectedRfqId = null;
    editingQrId = null;
    render();
    showTab('all');
  });

  loadVendors();
  render();
});
