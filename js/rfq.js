document.addEventListener('DOMContentLoaded', function () {
  const requiredIds = ['tabAllRfq', 'tabPendingPI', 'rfqAllView', 'rfqPendingView', 'rfqFormView', 'rfqAllBody', 'pendingPiBody', 'rfqCount', 'rfqVoucherNo', 'rfqDate', 'rfqPiNo', 'rfqLinesBody', 'rfqSaveBtn', 'rfqCancelBtn', 'rfqMessage'];
  const el = {};
  requiredIds.forEach((id) => {
    el[id] = document.getElementById(id);
    if (!el[id]) console.warn(`RFQ: missing #${id}`);
  });
  if (requiredIds.some((id) => !el[id])) return;

  let selectedPiId = null;
  let editingRfqId = null;
  let activeTab = 'all';
  const esc = IMS.esc;

  function message(text, error) {
    el.rfqMessage.textContent = text;
    el.rfqMessage.classList.toggle('error', Boolean(error));
  }

  function piStatus(pi) {
    return IMS.piStatus(pi);
  }

  function showTab(tab) {
    activeTab = tab;
    el.tabAllRfq.classList.toggle('active', tab === 'all');
    el.tabPendingPI.classList.toggle('active', tab === 'pending');
    el.rfqAllView.hidden = tab !== 'all';
    el.rfqPendingView.hidden = tab !== 'pending';
    el.rfqFormView.hidden = true;
  }

  function render() {
    const vouchers = IMS.rfqAll().slice().reverse();
    el.rfqAllBody.innerHTML = vouchers.length ? vouchers.map((rfq, index) => `
      <tr data-open-rfq="${esc(rfq.id)}"><td>${vouchers.length - index}</td><td>${esc(IMS.fmtDate(rfq.date))}</td>
      <td>${esc(rfq.no)}</td><td>${esc(rfq.piNo)}</td>
      <td>${Number((rfq.lines || []).length)}</td><td>${esc(rfq.linkStatus || IMS.rfqStatus(rfq))}</td>
      <td><button class="action-btn has-label" type="button" data-open-rfq-button="${esc(rfq.id)}">Open</button></td></tr>
    `).join('') : '<tr><td colspan="7">No RFQ vouchers yet.</td></tr>';
    el.rfqCount.textContent = String(vouchers.length);

    const pending = IMS.piAll().filter((pi) => piStatus(pi) !== 'Closed');
    el.pendingPiBody.innerHTML = pending.length ? pending.map((pi, index) => `
      <tr data-open-pi="${esc(pi.id)}"><td>${index + 1}</td><td>${esc(IMS.fmtDate(pi.date))}</td><td>${esc(pi.no)}</td>
      <td>${Number((pi.lines || []).length)}</td><td>${esc(piStatus(pi))}</td>
      <td><button class="action-btn has-label" type="button" data-create-rfq-from-pi="${esc(pi.id)}">Create RFQ</button></td></tr>
    `).join('') : '<tr><td colspan="6">No pending purchase indents.</td></tr>';
  }

  function openForm(piId, savedRfq = null) {
    const piList = IMS.piAll();
    const pi = piList.find((entry) => String(entry.id) === String(piId))
      || (savedRfq ? piList.find((entry) => String(entry.no || '') === String(savedRfq.piNo || '')) : null);
    if (!pi) return message('Purchase Indent not found.', true);
    selectedPiId = pi.id;
    editingRfqId = savedRfq?.id || null;
    const date = savedRfq?.date || IMS.todayISO();
    el.rfqDate.value = date;
    el.rfqVoucherNo.value = savedRfq?.no || IMS.peekNo('RFQU', date);
    el.rfqPiNo.value = pi.no;
    el.rfqLinesBody.innerHTML = (pi.lines || []).map((line, index) => {
      const previousQty = savedRfq?.lines?.find((savedLine) => savedLine.code === line.code)?.qty || 0;
      const balance = Math.max(0, Number(line.qty) - Number(line.consumed || 0) + Number(previousQty));
      const selectedQty = savedRfq
        ? Number(savedRfq.lines?.find((savedLine) => savedLine.code === line.code)?.qty) || 0
        : balance;
      const masterItem = IMS.items().find((item) => String(item.code) === String(line.code));
      return `<tr><td>${esc(line.category)}</td><td>${esc(line.brand)}</td>
        <td>${esc(line.name)} (${esc(line.code)})</td><td>${esc(line.description)}</td><td>${esc(line.unit)}</td>
        <td>${esc(masterItem?.stock ?? line.stock)}</td><td data-pi-balance="${index}">${balance}</td>
        <td><input class="ims-lines-input" type="number" min="0" max="${balance}" step="any" value="${selectedQty}" data-rfq-qty="${index}" aria-label="RFQ quantity for ${esc(line.name)}"></td></tr>`;
    }).join('');
    while (el.rfqLinesBody.rows.length < 5) {
      el.rfqLinesBody.insertAdjacentHTML('beforeend', '<tr class="voucher-empty-line">' + '<td></td>'.repeat(8) + '</tr>');
    }
    el.rfqAllView.hidden = true;
    el.rfqPendingView.hidden = true;
    el.rfqFormView.hidden = false;
    const linkedToQuotation = Boolean(savedRfq)
      && IMS.qrAll().some((qr) =>
        (qr.rfqId && String(qr.rfqId) === String(savedRfq.id))
        || (!qr.rfqId && String(qr.rfqNo || '') === String(savedRfq.no || ''))
      );
    el.rfqSaveBtn.disabled = linkedToQuotation;
    el.rfqSaveBtn.title = linkedToQuotation ? 'This RFQ is linked to a Quotation Receive and is read-only.' : '';
    message(linkedToQuotation ? 'This RFQ is linked to a Quotation Receive and is open in read-only mode.' : '', linkedToQuotation);
  }

  el.tabAllRfq.addEventListener('click', () => showTab('all'));
  el.tabPendingPI.addEventListener('click', () => showTab('pending'));
  el.rfqAllBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-rfq-button]');
    if (!button) return;
    const rfq = IMS.rfqAll().find((entry) => String(entry.id) === button.dataset.openRfqButton);
    if (rfq) openForm(rfq.piId, rfq);
  });
  el.pendingPiBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-create-rfq-from-pi]');
    if (button) openForm(button.dataset.createRfqFromPi);
  });
  el.pendingPiBody.addEventListener('dblclick', (event) => {
    const row = event.target.closest('[data-open-pi]');
    if (!row) return;
    openForm(row.dataset.openPi);
  });
  el.rfqAllBody.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    const row = event.target.closest('[data-open-rfq]');
    if (!row) return;
    const rfq = IMS.rfqAll().find((entry) => String(entry.id) === row.dataset.openRfq);
    if (rfq) openForm(rfq.piId, rfq);
  });
  el.rfqDate.addEventListener('change', () => {
    if (!editingRfqId) el.rfqVoucherNo.value = IMS.peekNo('RFQU', el.rfqDate.value);
  });
  el.rfqCancelBtn.addEventListener('click', () => {
    selectedPiId = null;
    editingRfqId = null;
    message('', false);
    showTab(activeTab);
  });
  el.rfqSaveBtn.addEventListener('click', () => {
    if (editingRfqId && IMS.qrAll().some((qr) => {
      const linkedRfq = IMS.rfqAll().find((entry) => String(entry.id) === String(editingRfqId));
      return (qr.rfqId && String(qr.rfqId) === String(editingRfqId))
        || (!qr.rfqId && linkedRfq && String(qr.rfqNo || '') === String(linkedRfq.no || ''));
    })) {
      return message('This RFQ is linked to a Quotation Receive and cannot be changed.', true);
    }
    const piList = IMS.piAll();
    const pi = piList.find((entry) => String(entry.id) === String(selectedPiId));
    if (!pi) return message('Purchase Indent not found.', true);
    if (!el.rfqDate.value) return message('Please select a date.', true);

    const oldRfq = editingRfqId
      ? IMS.rfqAll().find((entry) => String(entry.id) === String(editingRfqId))
      : null;
    if (editingRfqId && !oldRfq) return message('This RFQ no longer exists. Refresh the voucher list and try again.', true);
    const oldQuantities = new Map((oldRfq?.lines || []).map((line) => [line.code, Number(line.qty) || 0]));
    const rfqLines = [];
    (pi.lines || []).forEach((line, index) => {
      const balance = Math.max(0, Number(line.qty) - Number(line.consumed || 0) + (oldQuantities.get(line.code) || 0));
      const input = el.rfqLinesBody.querySelector(`[data-rfq-qty="${index}"]`);
      const qty = Number(input && input.value);
      if (!Number.isFinite(qty) || qty < 0 || qty > balance) return;
      if (qty > 0) {
        rfqLines.push({ ...line, qty, consumed: 0 });
      }
    });
    if (!rfqLines.length) return message('Enter a quantity greater than zero for at least one item.', true);
    if (el.rfqLinesBody.querySelectorAll('[data-rfq-qty]').length !== (pi.lines || []).length) {
      return message('Purchase Indent lines are incomplete.', true);
    }
    const badQty = [...el.rfqLinesBody.querySelectorAll('[data-rfq-qty]')].some((input) =>
      !Number.isFinite(Number(input.value)) || Number(input.value) < 0 || Number(input.value) > Number(input.max)
    );
    if (badQty) return message('RFQ quantity must be between zero and the PI balance.', true);

    const date = el.rfqDate.value;
    const voucher = {
      id: oldRfq?.id || IMS.uid(),
      no: oldRfq?.no || IMS.nextNo('RFQU', date),
      date,
      piId: pi.id,
      piNo: pi.no,
      lines: rfqLines,
      linkStatus: 'Pending'
    };
    const newQuantities = new Map(rfqLines.map((line) => [line.code, Number(line.qty) || 0]));
    pi.lines.forEach((line) => {
      line.consumed = Math.max(0, (Number(line.consumed) || 0) - (oldQuantities.get(line.code) || 0) + (newQuantities.get(line.code) || 0));
    });
    pi.linkStatus = piStatus(pi);
    piList[piList.findIndex((entry) => String(entry.id) === String(pi.id))] = pi;
    IMS.piSave(piList);
    const rfqList = IMS.rfqAll();
    IMS.rfqSave(oldRfq
      ? rfqList.map((entry) => String(entry.id) === String(oldRfq.id) ? voucher : entry)
      : [...rfqList, voucher]);
    selectedPiId = null;
    editingRfqId = null;
    render();
    showTab('all');
  });

  render();
});
