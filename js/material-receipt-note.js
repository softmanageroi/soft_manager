document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const allBody = $('mrnAllBody');
  const pendingBody = $('mrnPendingPoBody');
  const mrnForm = $('mrnFormView');
  const authorizeForm = $('mrnAuthorizeView');
  const listView = $('mrnListView');
  const message = $('mrnMessage');
  if (!allBody || !pendingBody || !mrnForm || !authorizeForm || !listView || !window.IMS) return;

  const esc = IMS.esc;
  let selectedOrderId = '';
  let authorizingOrderId = '';
  let viewingReceiptId = '';
  let contextLineIndex = -1;
  let readOnly = false;

  function receipts() {
    try {
      const saved = JSON.parse(localStorage.getItem('ims_mrn') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  }

  function remaining(line) {
    return Math.max(0, (Number(line.qty) || 0) - (Number(line.receivedQty) || 0));
  }

  function receiptWarehouse(order) {
    return order.authorizationDetails?.warehouse || order.printDetails?.warehouse || '';
  }

  function applyReceiptStock(lines, direction = 1) {
    const items = IMS.items();
    const quantities = new Map();
    (lines || []).forEach((line) => {
      const code = String(line.code || '');
      if (!code) throw new Error(`Item code is missing for ${line.name || 'a received item'}.`);
      quantities.set(code, (quantities.get(code) || 0) + (Number(line.receivedQty) || 0) * direction);
    });
    for (const code of quantities.keys()) {
      if (!items.some((item) => String(item.code) === code)) {
        throw new Error(`Item ${code} was not found in Item Master; stock was not updated.`);
      }
    }
    const updated = items.map((item) => ({
      ...item,
      stock: Math.max(0, (Number(item.stock) || 0) + (quantities.get(String(item.code)) || 0))
    }));
    localStorage.setItem('softManagerItems', JSON.stringify(updated));
    localStorage.setItem('ims_items', JSON.stringify(updated));
  }

  function captureStorage(keys) {
    return keys.map((key) => [key, localStorage.getItem(key)]);
  }

  function restoreStorage(snapshot) {
    snapshot.forEach(([key, value]) => value === null
      ? localStorage.removeItem(key)
      : localStorage.setItem(key, value));
  }

  function postUnpostedReceiptStock() {
    const savedNotes = receipts();
    const pending = savedNotes.filter((note) => note.stockPosted !== true);
    if (!pending.length) return;
    const snapshot = captureStorage(['softManagerItems', 'ims_items', 'ims_mrn']);
    try {
      pending.forEach((note) => applyReceiptStock(note.lines || []));
      const postedIds = new Set(pending.map((note) => String(note.id)));
      localStorage.setItem('ims_mrn', JSON.stringify(savedNotes.map((note) =>
        postedIds.has(String(note.id)) ? { ...note, stockPosted: true } : note
      )));
    } catch (error) {
      restoreStorage(snapshot);
      console.error('MRN stock posting failed:', error);
      showMessage(`Could not update stock from saved MRNs: ${error.message}`, true);
    }
  }

  function pendingOrders() {
    return IMS.purchaseOrders().filter((order) =>
      (order.lines || []).some((line) => remaining(line) > 0)
    );
  }

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle('error', isError);
  }

  function render() {
    const savedReceipts = receipts().slice().reverse();
    allBody.innerHTML = savedReceipts.length ? savedReceipts.map((note, index) => {
      const order = IMS.purchaseOrders().find((item) => String(item.id) === String(note.poId));
      const billNo = note.billNumber || order?.authorizationDetails?.billNumber || '';
      const billDate = note.billDate || order?.authorizationDetails?.billDate || '';
      const poDate = note.poDate || order?.date || '';
      return `<tr data-open-mrn="${esc(note.id)}" title="Double-click to view this voucher">
        <td>${savedReceipts.length - index}</td><td>${esc(note.no)}</td><td>${esc(IMS.fmtDate(note.date))}</td>
        <td>${esc(note.poNo)}</td><td>${esc(IMS.fmtDate(poDate))}</td><td>${esc(billNo)}</td><td>${esc(IMS.fmtDate(billDate))}</td>
        <td>${esc(note.supplier)}</td><td>${esc(note.warehouse || '')}</td>
        <td>${(note.lines || []).reduce((sum, line) => sum + (Number(line.receivedQty) || 0), 0)}</td><td>${esc(note.status)}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="11">No material receipt vouchers yet.</td></tr>';
    $('mrnCount').textContent = String(savedReceipts.length);

    const orders = pendingOrders();
    pendingBody.innerHTML = orders.length ? orders.map((order, index) => {
      const poQty = (order.lines || []).reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
      const balance = (order.lines || []).reduce((sum, line) => sum + remaining(line), 0);
      const authorization = order.authorizationDetails || {};
      const isAuthorized = String(order.authorizationStatus || '').toLowerCase() === 'approved';
      const action = isAuthorized
        ? `<button class="action-btn mrn-create-action" type="button" data-create-mrn="${esc(order.id)}" title="Create MRN" aria-label="Create MRN for ${esc(order.no)}"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>`
        : `<button class="action-btn mrn-authorize-action" type="button" data-authorize-po="${esc(order.id)}">Authorize</button>`;
      return `<tr data-open-pending-po="${esc(order.id)}" title="Double-click to open this purchase order">
        <td>${index + 1}</td><td>${esc(order.no)}</td><td>${esc(IMS.fmtDate(order.date))}</td>
        <td>${esc(authorization.billNumber || '')}</td><td>${esc(IMS.fmtDate(authorization.billDate || ''))}</td>
        <td>${esc(order.supplier)}</td><td>${esc(receiptWarehouse(order))}</td><td>${poQty}</td><td>${balance}</td>
        <td>${esc(order.authorizationStatus || 'Pending Authorization')}</td><td>${action}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="11">No purchase orders are pending receipt.</td></tr>';
  }

  function setTab(tab) {
    $('tabAllMrn').classList.toggle('active', tab === 'all');
    $('tabPendingPo').classList.toggle('active', tab === 'pending');
    $('tabAllMrn').setAttribute('aria-selected', String(tab === 'all'));
    $('tabPendingPo').setAttribute('aria-selected', String(tab === 'pending'));
    $('mrnAllView').hidden = tab !== 'all';
    $('mrnPendingPoView').hidden = tab !== 'pending';
  }

  function closeForm() {
    mrnForm.hidden = true;
    authorizeForm.hidden = true;
    listView.hidden = false;
    document.body.classList.remove('mrn-form-active');
    selectedOrderId = '';
    authorizingOrderId = '';
    viewingReceiptId = '';
    hideItemContextMenu();
    readOnly = false;
    $('mrnDate').readOnly = false;
    $('saveMrnBtn').hidden = false;
    render();
  }

  function openReceipt(order, savedNote = null) {
    selectedOrderId = order.id;
    readOnly = Boolean(savedNote);
    const date = savedNote?.date || IMS.todayISO();
    $('mrnNo').value = savedNote?.no || IMS.peekNo('MRN', date);
    $('mrnDate').value = date;
    $('mrnDate').readOnly = readOnly;
    $('mrnPoNo').value = savedNote?.poNo || order.no || '';
    $('mrnPoDate').value = IMS.fmtDate(savedNote?.poDate || order.date || '');
    $('mrnBillNo').value = savedNote?.billNumber || order.authorizationDetails?.billNumber || '';
    $('mrnBillDate').value = IMS.fmtDate(savedNote?.billDate || order.authorizationDetails?.billDate || '');
    $('mrnSupplier').value = savedNote?.supplier || order.supplier || '';
    $('mrnWarehouse').value = savedNote?.warehouse || receiptWarehouse(order);
    $('mrnFormTitle').textContent = savedNote ? `Material Receipt Note — ${savedNote.no}` : `Receive against ${order.no}`;
    $('saveMrnBtn').hidden = readOnly;
    showMessage('');

    viewingReceiptId = savedNote?.id || '';
    const noteLines = savedNote?.lines || [];
    $('mrnLinesBody').innerHTML = noteLines.length ? noteLines.map((line, index) => `
      <tr ${readOnly ? `data-mrn-saved-line="${index}" title="Right-click to remove this item from the MRN"` : ''}><td>${index + 1}</td><td>${esc(line.name)} (${esc(line.code)})</td><td>${Number(line.poQty) || 0}</td>
        <td>${Number(line.receivedEarlier) || 0}</td><td>${Number(line.balanceBefore) || 0}</td>
        <td>${Number(line.receivedQty) || 0}</td><td>${esc(line.unit || '')}</td><td>${(Number(line.rate) || 0).toFixed(2)}</td></tr>`).join('')
      : (order.lines || []).map((line, index) => `
      <tr><td>${index + 1}</td><td>${esc(line.name || line.itemName || '')} (${esc(line.code || '')})</td>
        <td>${Number(line.qty) || 0}</td><td>${Number(line.receivedQty) || 0}</td><td>${remaining(line)}</td>
        <td><input class="ims-lines-input mrn-qty-input" type="number" min="0" max="${remaining(line)}" step="any" value="0" data-mrn-line="${index}" aria-label="Receiving now for ${esc(line.name || line.itemName || '')}" ${readOnly ? 'readonly' : ''}></td>
        <td>${esc(line.unit || '')}</td><td>${(Number(line.rate) || 0).toFixed(2)}</td></tr>`).join('');
    while ($('mrnLinesBody').rows.length < 5) {
      $('mrnLinesBody').insertAdjacentHTML('beforeend', '<tr class="voucher-empty-line">' + '<td></td>'.repeat(8) + '</tr>');
    }

    listView.hidden = true;
    mrnForm.hidden = false;
    document.body.classList.add('mrn-form-active');
  }

  function hideItemContextMenu() {
    $('mrnItemContextMenu').hidden = true;
    contextLineIndex = -1;
  }

  function updateReceiptStatus(lines) {
    const received = lines.reduce((sum, line) => sum + (Number(line.receivedQty) || 0), 0);
    const complete = lines.every((line) => remaining(line) <= 0);
    return complete ? 'Received' : received > 0 ? 'Partially Received' : 'Pending Receipt';
  }

  function removeReceiptLine(lineIndex) {
    const savedNotes = receipts();
    const noteIndex = savedNotes.findIndex((note) => String(note.id) === String(viewingReceiptId));
    if (noteIndex < 0) return;
    const note = savedNotes[noteIndex];
    const removedLine = note.lines?.[lineIndex];
    if (!removedLine) return;
    const order = IMS.purchaseOrders().find((item) => String(item.id) === String(note.poId));
    if (!order) return showMessage('Purchase order not found; item was not removed.', true);
    if (!window.confirm(`Remove ${removedLine.name || removedLine.code || 'this item'} from ${note.no}? Its quantity will return to Pending Purchase Order.`)) return;

    const orderLines = (order.lines || []).map((line) => ({ ...line }));
    let quantityToReverse = Number(removedLine.receivedQty) || 0;
    const matchingIndexes = Number.isInteger(removedLine.poLineIndex)
      ? [removedLine.poLineIndex]
      : orderLines.map((line, index) => ({ line, index }))
        .filter(({ line }) => removedLine.code ? String(line.code || '') === String(removedLine.code) : String(line.name || line.itemName || '') === String(removedLine.name || ''))
        .map(({ index }) => index);
    for (const index of matchingIndexes) {
      const line = orderLines[index];
      if (!line || quantityToReverse <= 0) continue;
      const amount = Math.min(Number(line.receivedQty) || 0, quantityToReverse);
      line.receivedQty = (Number(line.receivedQty) || 0) - amount;
      quantityToReverse -= amount;
    }
    if (quantityToReverse > 0) return showMessage('Could not match the received quantity to its purchase-order item.', true);

    const remainingLines = note.lines.filter((_, index) => index !== lineIndex);
    if (remainingLines.length) {
      note.lines = remainingLines;
      note.status = 'Partially Received';
      savedNotes[noteIndex] = note;
    } else {
      savedNotes.splice(noteIndex, 1);
    }
    const storageSnapshot = captureStorage(['ims_purchase_orders', 'ims_mrn', 'softManagerItems', 'ims_items']);
    try {
      IMS.purchaseOrdersSave(IMS.purchaseOrders().map((item) => String(item.id) === String(order.id)
        ? { ...item, lines: orderLines, receiptStatus: updateReceiptStatus(orderLines) }
        : item));
      applyReceiptStock([removedLine], -1);
      localStorage.setItem('ims_mrn', JSON.stringify(savedNotes));
      hideItemContextMenu();
      if (remainingLines.length) {
        const updatedNote = savedNotes[noteIndex];
        const updatedOrder = IMS.purchaseOrders().find((item) => String(item.id) === String(order.id));
        openReceipt(updatedOrder, updatedNote);
        showMessage('Item removed. Its balance is back in Pending Purchase Order.');
      } else {
        closeForm();
        setTab('all');
      }
    } catch (error) {
      restoreStorage(storageSnapshot);
      showMessage(`Could not remove item: ${error.message}`, true);
    }
  }

  function openAuthorization(order) {
    authorizingOrderId = order.id;
    $('authorizePoNo').value = order.no;
    $('authorizePoDate').value = IMS.fmtDate(order.date || '');
    const poLines = order.lines || [];
    const quotation = IMS.qrAll().find((entry) => String(entry.id) === String(order.quotationId));
    const isIgst = quotation?.taxType === 'inter' || order.printDetails?.isIgst === 'Yes';
    const money = (value) => (Number(value) || 0).toFixed(2);
    const gstDetails = (line, taxable) => {
      const masterItem = IMS.items().find((item) => String(item.code) === String(line.code));
      const hasPoRate = line.gstRate !== undefined && line.gstRate !== null && line.gstRate !== '';
      const hasMasterRate = masterItem?.gst !== undefined && masterItem?.gst !== null && masterItem?.gst !== '';
      const savedTax = (Number(line.cgst) || 0) + (Number(line.sgst) || 0) + (Number(line.igst) || 0);
      const gstRate = hasPoRate ? Number(line.gstRate) || 0
        : hasMasterRate ? Number(masterItem.gst) || 0
          : taxable && savedTax ? savedTax / taxable * 100 : 0;
      const fallbackTax = taxable * gstRate / 100;
      const cgst = Number(line.cgst) || (savedTax ? 0 : isIgst ? 0 : fallbackTax / 2);
      const sgst = Number(line.sgst) || (savedTax ? 0 : isIgst ? 0 : fallbackTax / 2);
      const igst = Number(line.igst) || (savedTax ? 0 : isIgst ? fallbackTax : 0);
      return { gstRate, cgst, sgst, igst };
    };
    const poTotals = poLines.reduce((sum, line) => {
      const gross = (Number(line.qty) || 0) * (Number(line.rate) || 0);
      const discount = Number(line.discount) || 0;
      const freight = Number(line.freightCharges) || 0;
      const taxable = Number(line.taxableAmount ?? (gross - discount + freight)) || 0;
      const { cgst, sgst, igst } = gstDetails(line, taxable);
      sum.qty += Number(line.qty) || 0;
      sum.gross += gross;
      sum.discount += discount;
      sum.freight += freight;
      sum.taxable += taxable;
      sum.cgst += cgst;
      sum.sgst += sgst;
      sum.igst += igst;
      sum.gst += cgst + sgst + igst;
      sum.net += taxable + cgst + sgst + igst;
      return sum;
    }, { qty: 0, gross: 0, discount: 0, freight: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, gst: 0, net: 0 });
    $('authorizePoItemsBody').innerHTML = poLines.length ? poLines.map((line, index) => {
      const qty = Number(line.qty) || 0;
      const rate = Number(line.rate) || 0;
      const gross = qty * rate;
      const discount = Number(line.discount) || 0;
      const freight = Number(line.freightCharges) || 0;
      const taxable = Number(line.taxableAmount ?? (gross - discount + freight)) || 0;
      const { gstRate, cgst, sgst, igst } = gstDetails(line, taxable);
      const gst = cgst + sgst + igst;
      return `<tr><td>${index + 1}</td><td>${esc(line.brand || line.brandName || '')}</td><td>${esc(line.code || '')}</td>
        <td>${esc([line.name || line.itemName || 'Item', line.description].filter(Boolean).join(' — '))}</td>
        <td class="numeric">${money(qty)}</td><td>${esc(line.unit || '')}</td><td class="numeric">${money(rate)}</td>
        <td class="numeric">${money(gross)}</td><td class="numeric">${money(discount)}</td><td class="numeric">${money(taxable)}</td>
        <td>${esc(order.quotationNo || quotation?.no || '')}</td><td class="numeric">${money(gstRate)}%</td><td class="numeric">${money(cgst)}</td><td class="numeric">${money(sgst)}</td>
        <td class="numeric">${money(igst)}</td><td class="numeric">${money(gst)}</td><td class="numeric">${money(taxable + gst)}</td></tr>`;
    }).join('') + Array.from({ length: Math.max(0, 5 - poLines.length) }, () => '<tr class="voucher-empty-line">' + '<td></td>'.repeat(17) + '</tr>').join('') + `<tr class="mrn-po-total-row"><th colspan="4">Total</th><th class="numeric">${money(poTotals.qty)}</th><th></th><th></th>
      <th class="numeric">${money(poTotals.gross)}</th><th class="numeric">${money(poTotals.discount)}</th><th class="numeric">${money(poTotals.taxable)}</th><th></th><th></th>
      <th class="numeric">${money(poTotals.cgst)}</th><th class="numeric">${money(poTotals.sgst)}</th><th class="numeric">${money(poTotals.igst)}</th>
      <th class="numeric">${money(poTotals.gst)}</th><th class="numeric">${money(poTotals.net)}</th></tr>`
      : '<tr><td colspan="17">No items found in this purchase order.</td></tr>';
    $('authorizePoItemsTotal').textContent = money(poTotals.net);
    $('supplierBillNo').value = order.authorizationDetails?.billNumber || '';
    $('supplierBillDate').value = order.authorizationDetails?.billDate || '';
    const warehouseSelect = $('authorizeWarehouse');
    const warehouses = IMS.warehouseRecords();
    const selected = order.authorizationDetails?.warehouse || order.printDetails?.warehouse || '';
    if (selected && !warehouses.some((warehouse) => warehouse.name === selected)) {
      warehouses.push({ name: selected });
    }
    warehouseSelect.innerHTML = `<option value="">Select warehouse</option>${warehouses.map((warehouse) =>
      `<option value="${esc(warehouse.name)}">${esc(warehouse.name)}</option>`
    ).join('')}`;
    warehouseSelect.value = selected;
    $('mrnAuthorizeMessage').textContent = '';
    $('mrnAuthorizeMessage').classList.remove('error');
    listView.hidden = true;
    mrnForm.hidden = true;
    authorizeForm.hidden = false;
    document.body.classList.add('mrn-form-active');
  }

  $('tabAllMrn').addEventListener('click', () => setTab('all'));
  $('tabPendingPo').addEventListener('click', () => setTab('pending'));
  pendingBody.addEventListener('click', (event) => {
    const authorizeButton = event.target.closest('[data-authorize-po]');
    if (authorizeButton) {
      const order = pendingOrders().find((item) => String(item.id) === authorizeButton.dataset.authorizePo);
      if (order) openAuthorization(order);
      return;
    }
    const button = event.target.closest('[data-create-mrn]');
    if (!button) return;
    const order = pendingOrders().find((item) => String(item.id) === button.dataset.createMrn);
    if (order) openReceipt(order);
  });
  pendingBody.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    const row = event.target.closest('[data-open-pending-po]');
    if (!row) return;
    const order = pendingOrders().find((item) => String(item.id) === row.dataset.openPendingPo);
    if (!order) return;
    if (String(order.authorizationStatus || '').toLowerCase() === 'approved') {
      openReceipt(order);
    } else {
      openAuthorization(order);
    }
  });
  function openSavedReceiptFromRow(event) {
    const row = event.target.closest('[data-open-mrn]');
    if (!row) return false;
    const note = receipts().find((item) => String(item.id) === row.dataset.openMrn);
    if (!note) return false;
    const order = IMS.purchaseOrders().find((item) =>
      (note.poId && String(item.id) === String(note.poId)) ||
      (!note.poId && note.poNo && String(item.no) === String(note.poNo))
    ) || {
      id: note.poId || '',
      no: note.poNo || '',
      date: note.poDate || '',
      supplier: note.supplier || '',
      lines: []
    };
    openReceipt(order, note);
    return true;
  }
  allBody.addEventListener('click', openSavedReceiptFromRow);
  allBody.addEventListener('dblclick', openSavedReceiptFromRow);
  $('mrnLinesBody').addEventListener('contextmenu', (event) => {
    const row = event.target.closest('[data-mrn-saved-line]');
    if (!row || !readOnly) return;
    event.preventDefault();
    contextLineIndex = Number(row.dataset.mrnSavedLine);
    const menu = $('mrnItemContextMenu');
    menu.hidden = false;
    const left = Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8);
    const top = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
  });
  $('removeMrnItemBtn').addEventListener('click', () => {
    if (contextLineIndex >= 0) removeReceiptLine(contextLineIndex);
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#mrnItemContextMenu')) hideItemContextMenu();
  });
  window.addEventListener('scroll', hideItemContextMenu, true);
  $('cancelMrnBtn').addEventListener('click', closeForm);
  $('cancelPoAuthorizationBtn').addEventListener('click', closeForm);
  $('savePoAuthorizationBtn').addEventListener('click', () => {
    const order = IMS.purchaseOrders().find((item) => String(item.id) === String(authorizingOrderId));
    const billNumber = $('supplierBillNo').value.trim();
    const billDate = $('supplierBillDate').value;
    const warehouse = $('authorizeWarehouse').value;
    if (!order) {
      $('mrnAuthorizeMessage').textContent = 'Purchase order not found. Refresh and try again.';
      $('mrnAuthorizeMessage').classList.add('error');
      return;
    }
    if (!billNumber || !billDate || !warehouse) {
      $('mrnAuthorizeMessage').textContent = 'Bill number, bill date, and warehouse are required to authorize this PO.';
      $('mrnAuthorizeMessage').classList.add('error');
      return;
    }
    try {
      IMS.purchaseOrdersSave(IMS.purchaseOrders().map((item) => String(item.id) === String(order.id)
        ? { ...item, authorizationStatus: 'Approved', authorizedAt: new Date().toISOString(), authorizationDetails: { billNumber, billDate, warehouse } }
        : item));
      closeForm();
      setTab('pending');
    } catch (error) {
      $('mrnAuthorizeMessage').textContent = `Could not authorize purchase order: ${error.message}`;
      $('mrnAuthorizeMessage').classList.add('error');
    }
  });
  $('saveMrnBtn').addEventListener('click', () => {
    const order = IMS.purchaseOrders().find((item) => String(item.id) === String(selectedOrderId));
    if (!order) return showMessage('Purchase order not found. Refresh and try again.', true);
    if (!$('mrnDate').value) return showMessage('Receipt date is required.', true);

    const inputs = [...$('mrnLinesBody').querySelectorAll('[data-mrn-line]')];
    const requested = inputs.map((input) => ({ index: Number(input.dataset.mrnLine), qty: Number(input.value) || 0 }));
    if (!requested.some((line) => line.qty > 0)) return showMessage('Enter a receiving quantity for at least one item.', true);
    const poLines = (order.lines || []).map((line) => ({ ...line }));
    for (const line of requested) {
      const poLine = poLines[line.index];
      if (!poLine || line.qty < 0 || line.qty > remaining(poLine)) {
        return showMessage('Receiving quantity cannot exceed the pending PO quantity.', true);
      }
    }

    const date = $('mrnDate').value;
    const noteLines = requested.filter((line) => line.qty > 0).map(({ index, qty }) => {
      const poLine = poLines[index];
      const balanceBefore = remaining(poLine);
      const receivedEarlier = Number(poLine.receivedQty) || 0;
      poLine.receivedQty = receivedEarlier + qty;
      return {
        code: poLine.code || '', name: poLine.name || poLine.itemName || '', unit: poLine.unit || '',
        poLineIndex: index, poQty: Number(poLine.qty) || 0, receivedEarlier, balanceBefore, receivedQty: qty, rate: Number(poLine.rate) || 0
      };
    });
    const fullyReceived = poLines.every((line) => remaining(line) <= 0);
    const mrnList = receipts();
    const note = {
      id: IMS.uid(), no: IMS.nextNo('MRN', date), date, poId: order.id, poNo: order.no,
      poDate: order.date || '', billNumber: order.authorizationDetails?.billNumber || '', billDate: order.authorizationDetails?.billDate || '',
      supplier: order.supplier || '', warehouse: receiptWarehouse(order),
      status: fullyReceived ? 'Received' : 'Partially Received', lines: noteLines, stockPosted: true
    };
    const storageSnapshot = captureStorage(['ims_purchase_orders', 'ims_mrn', 'softManagerItems', 'ims_items']);
    try {
      IMS.purchaseOrdersSave(IMS.purchaseOrders().map((item) => String(item.id) === String(order.id)
        ? { ...item, lines: poLines, receiptStatus: note.status }
        : item));
      localStorage.setItem('ims_mrn', JSON.stringify([...mrnList, note]));
      applyReceiptStock(noteLines);
      closeForm();
      setTab('all');
    } catch (error) {
      restoreStorage(storageSnapshot);
      showMessage(`Could not save MRN: ${error.message}`, true);
      return;
    }
  });

  postUnpostedReceiptStock();
  render();
  const authorizePoId = new URLSearchParams(window.location.search).get('authorizePo');
  if (authorizePoId) {
    setTab('pending');
    const order = pendingOrders().find((item) => String(item.id) === authorizePoId);
    if (order) openAuthorization(order);
  }
});
