document.addEventListener('DOMContentLoaded', function () {
  const requiredIds = ['piListView', 'piFormView', 'piNewBtn', 'piListBody', 'piCount', 'piVoucherNo', 'piDate', 'piLinesBody', 'piSaveBtn', 'piCancelBtn', 'piMessage', 'piItemOptions'];
  const elements = {};
  requiredIds.forEach((id) => {
    elements[id] = document.getElementById(id);
    if (!elements[id]) console.warn(`Purchase Indent: missing #${id}`);
  });
  if (requiredIds.some((id) => !elements[id])) return;

  const esc = IMS.esc;
  const baseRowCount = 5;
  let editingPiId = null;
  const requestedByField = document.getElementById('piRequestedBy');
  IMS.setEmployeeOptions(requestedByField);

  function message(text, error) {
    elements.piMessage.textContent = text;
    elements.piMessage.classList.toggle('error', Boolean(error));
  }

  function renderList() {
    const vouchers = IMS.piAll().slice().reverse();
    elements.piListBody.innerHTML = vouchers.length ? vouchers.map((pi, index) => `
      <tr data-open-pi="${esc(pi.id)}" title="Double-click to open this voucher">
        <td>${vouchers.length - index}</td>
        <td>${esc(IMS.fmtDate(pi.date))}</td>
        <td>${esc(pi.no)}</td>
        <td>${Number((pi.lines || []).length)}</td>
        <td>${esc(pi.linkStatus || IMS.piStatus(pi))}</td>
      </tr>`).join('') : '<tr><td colspan="6">No purchase indent vouchers yet.</td></tr>';
    elements.piCount.textContent = String(vouchers.length);
  }

  function renderEmptyRow(index) {
    return `<tr>
      <td>${index + 1}</td>
      <td data-line-brand></td>
      <td><input data-line-item type="text" list="piItemOptions" autocomplete="off" aria-label="Type or select item for row ${index + 1}"></td>
      <td data-line-description></td>
      <td data-line-unit></td>
      <td><input data-line-qty type="number" min="0.01" step="any" aria-label="Quantity for row ${index + 1}"></td>
      <td data-line-stock></td>
    </tr>`;
  }

  function renderRows(count = baseRowCount) {
    elements.piItemOptions.innerHTML = IMS.items().map((item) =>
      `<option value="${esc(`${item.name} (${item.code})`)}" label="${esc(`${item.name}${item.brand ? ` — ${item.brand}` : ''}`)}"></option>`
    ).join('');
    elements.piLinesBody.innerHTML = Array.from({ length: count }, (_, index) => renderEmptyRow(index)).join('');
  }

  function clearItemDetails(row) {
    row.dataset.itemCode = '';
    row.dataset.itemCategory = '';
    row.querySelector('[data-line-brand]').textContent = '';
    row.querySelector('[data-line-description]').textContent = '';
    row.querySelector('[data-line-unit]').textContent = '';
    row.querySelector('[data-line-stock]').textContent = '';
  }

  function fillItemDetails(row) {
    const itemInput = row.querySelector('[data-line-item]');
    const value = itemInput.value.trim().toLocaleLowerCase();
    const matches = IMS.items().filter((entry) =>
      entry.name.trim().toLocaleLowerCase() === value
      || entry.code.trim().toLocaleLowerCase() === value
      || `${entry.name} (${entry.code})`.trim().toLocaleLowerCase() === value
    );
    if (!value || matches.length !== 1) {
      clearItemDetails(row);
      if (value && matches.length > 1) {
        message('More than one item has this name. Use a unique item name in Item Master.', true);
      }
      return;
    }
    const item = matches[0];
    itemInput.value = item.name;
    row.dataset.itemCode = item.code;
    row.dataset.itemCategory = item.category || '';
    row.querySelector('[data-line-brand]').textContent = item.brand || '';
    row.querySelector('[data-line-description]').textContent = item.description || '';
    row.querySelector('[data-line-unit]').textContent = item.unit;
    row.querySelector('[data-line-stock]').textContent = String(item.stock);
    message('', false);
    if (row === elements.piLinesBody.lastElementChild) {
      elements.piLinesBody.insertAdjacentHTML('beforeend', renderEmptyRow(elements.piLinesBody.rows.length));
    }
  }

  function openForm() {
    editingPiId = null;
    elements.piSaveBtn.disabled = false;
    elements.piSaveBtn.title = '';
    elements.piDate.value = IMS.todayISO();
    elements.piVoucherNo.value = IMS.peekNo('PIU', elements.piDate.value);
    document.getElementById('piLocation').value = 'Office';
    document.getElementById('piNarration').value = '';
    IMS.setEmployeeOptions(requestedByField);
    elements.piListView.hidden = true;
    elements.piFormView.hidden = false;
    message('', false);
    renderRows();
  }

  function openSavedIndent(piId) {
    const pi = IMS.piAll().find((entry) => String(entry.id) === String(piId));
    if (!pi) return;
    editingPiId = pi.id;
    elements.piDate.value = pi.date || IMS.todayISO();
    elements.piVoucherNo.value = pi.no;
    document.getElementById('piLocation').value = pi.location || 'Office';
    document.getElementById('piNarration').value = pi.narration || '';
    IMS.setEmployeeOptions(requestedByField, pi.requestedBy || '');
    elements.piListView.hidden = true;
    elements.piFormView.hidden = false;
    const linkedToRfq = IMS.rfqAll().some((rfq) =>
      (rfq.piId && String(rfq.piId) === String(pi.id))
      || (!rfq.piId && String(rfq.piNo || '') === String(pi.no || ''))
    );
    elements.piSaveBtn.disabled = linkedToRfq;
    elements.piSaveBtn.title = linkedToRfq ? 'This Purchase Indent is linked to an RFQ and is read-only.' : '';
    message(linkedToRfq ? 'This Purchase Indent is linked to an RFQ and is open in read-only mode.' : '', linkedToRfq);
    renderRows(Math.max(baseRowCount, (pi.lines || []).length + 1));
    (pi.lines || []).forEach((line, index) => {
      const row = elements.piLinesBody.rows[index];
      const itemInput = row.querySelector('[data-line-item]');
      itemInput.value = line.name || '';
      row.dataset.itemCode = line.code || '';
      row.dataset.itemCategory = line.category || '';
      row.querySelector('[data-line-brand]').textContent = line.brand || '';
      row.querySelector('[data-line-description]').textContent = line.description || '';
      row.querySelector('[data-line-unit]').textContent = line.unit || '';
      const masterItem = IMS.items().find((item) => String(item.code) === String(line.code));
      row.querySelector('[data-line-stock]').textContent = String(masterItem?.stock ?? line.stock ?? '');
      row.querySelector('[data-line-qty]').value = String(line.qty ?? '');
    });
  }

  function closeForm() {
    editingPiId = null;
    elements.piSaveBtn.disabled = false;
    elements.piSaveBtn.title = '';
    elements.piFormView.hidden = true;
    elements.piListView.hidden = false;
    message('', false);
  }

  elements.piNewBtn.addEventListener('click', openForm);
  elements.piCancelBtn.addEventListener('click', closeForm);
  elements.piListBody.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    const row = event.target.closest('[data-open-pi]');
    if (row) openSavedIndent(row.dataset.openPi);
  });
  elements.piDate.addEventListener('change', () => {
    if (!editingPiId) elements.piVoucherNo.value = IMS.peekNo('PIU', elements.piDate.value);
  });
  elements.piLinesBody.addEventListener('input', (event) => {
    const row = event.target.closest('tr');
    if (row && event.target.matches('[data-line-item]')) {
      fillItemDetails(row);
    }
  });
  elements.piLinesBody.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || event.shiftKey || !event.target.matches('[data-line-qty]')) return;
    const row = event.target.closest('tr');
    if (row !== elements.piLinesBody.lastElementChild) return;

    event.preventDefault();
    elements.piLinesBody.insertAdjacentHTML('beforeend', renderEmptyRow(elements.piLinesBody.rows.length));
    elements.piLinesBody.lastElementChild.querySelector('[data-line-item]')?.focus();
  });
  elements.piLinesBody.addEventListener('change', (event) => {
    const row = event.target.closest('tr');
    const input = event.target;
    if (!row || !input.matches('[data-line-item]') || !input.value.trim() || row.dataset.itemCode) return;
    message('Item not found. Add it with its brand in Item Master, then select it here.', true);
  });
  elements.piSaveBtn.addEventListener('click', () => {
    if (editingPiId) {
      const linkedPi = IMS.piAll().find((entry) => String(entry.id) === String(editingPiId));
      if (IMS.rfqAll().some((rfq) =>
        (rfq.piId && String(rfq.piId) === String(editingPiId))
        || (!rfq.piId && linkedPi && String(rfq.piNo || '') === String(linkedPi.no || ''))
      )) {
        return message('This Purchase Indent is linked to an RFQ and cannot be changed.', true);
      }
    }
    const rows = [...elements.piLinesBody.querySelectorAll('tr')];
    const lines = [];
    for (const row of rows) {
      const code = row.querySelector('[data-line-item]').value;
      if (!code.trim()) continue;
      const item = IMS.items().find((entry) => entry.code === row.dataset.itemCode);
      if (!item) return message(`"${code}" is not in Item Master. Add the item and its brand there first.`, true);
      const qty = Number(row.querySelector('[data-line-qty]').value);
      if (!Number.isFinite(qty) || qty <= 0) {
        return message(`Enter a quantity greater than zero for ${item.name}.`, true);
      }
      lines.push({
        code: item.code,
        name: item.name,
        category: row.dataset.itemCategory,
        brand: item.brand,
        description: item.description,
        unit: item.unit,
        stock: item.stock,
        qty,
        consumed: 0
      });
    }
    if (!lines.length) return message('Select at least one item before saving.', true);
    const date = elements.piDate.value;
    if (!date) return message('Please select a date.', true);
    const existingPi = editingPiId
      ? IMS.piAll().find((entry) => String(entry.id) === String(editingPiId))
      : null;
    if (editingPiId && !existingPi) return message('This Purchase Indent no longer exists. Refresh the voucher list and try again.', true);
    const pi = {
      id: existingPi?.id || IMS.uid(),
      no: existingPi?.no || IMS.nextNo('PIU', date),
      date,
      location: document.getElementById('piLocation').value,
      narration: document.getElementById('piNarration').value.trim(),
      requestedBy: document.getElementById('piRequestedBy').value.trim(),
      lines,
      linkStatus: 'Pending'
    };
    const indentList = IMS.piAll();
    IMS.piSave(existingPi
      ? indentList.map((entry) => String(entry.id) === String(existingPi.id) ? pi : entry)
      : [...indentList, pi]);
    editingPiId = null;
    renderList();
    closeForm();
  });

  renderRows();
  renderList();
});
