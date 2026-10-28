document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const allBody = $('issueAllBody');
  const pendingBody = $('issuePendingBody');
  const allView = $('issueAllView');
  const pendingView = $('issuePendingView');
  const tabAll = $('tabAllIssue');
  const tabPending = $('tabPendingIssue');
  const countSpan = $('issueCount');
  const pendingCountSpan = $('issuePendingCount');
  const message = $('issueListMessage');

  if (!allBody || !pendingBody || !window.IMS) return;

  const VOUCHERS_KEY = 'materialRequisitionVouchers';
  const approvedStatuses = new Set(['approved', 'authorized', 'issued', 'completed']);
  const closedStatuses = new Set([...approvedStatuses, 'rejected', 'cancelled', 'canceled', 'void']);

  function readVouchers() {
    const stored = JSON.parse(localStorage.getItem(VOUCHERS_KEY) || '[]');
    if (!Array.isArray(stored)) throw new TypeError('Saved material issue vouchers must be an array.');
    if (!stored.every((voucher) => voucher && typeof voucher === 'object' && !Array.isArray(voucher))) {
      throw new TypeError('Saved material issue vouchers contain an invalid record.');
    }
    return stored;
  }

  function voucherStatus(voucher) {
    return String(voucher?.authorizationStatus || voucher?.status || 'Pending').trim() || 'Pending';
  }

  function isApproved(voucher) {
    return approvedStatuses.has(voucherStatus(voucher).toLocaleLowerCase());
  }

  function isPending(voucher) {
    return !closedStatuses.has(voucherStatus(voucher).toLocaleLowerCase());
  }

  function openVoucher(docNo, returnTo) {
    const params = new URLSearchParams({ docNo: String(docNo), returnTo });
    window.location.href = `voucher-create.html?${params.toString()}`;
  }

  function setActiveView(view, updateUrl = false) {
    const showPending = view === 'pending';
    tabAll.classList.toggle('active', !showPending);
    tabPending.classList.toggle('active', showPending);
    tabAll.setAttribute('aria-selected', String(!showPending));
    tabPending.setAttribute('aria-selected', String(showPending));
    allView.hidden = showPending;
    pendingView.hidden = !showPending;

    if (updateUrl) {
      const params = new URLSearchParams(window.location.search);
      params.set('view', showPending ? 'pending' : 'all');
      params.delete('saved');
      params.delete('authorized');
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
      if (message) {
        message.textContent = '';
        message.hidden = true;
      }
    }
  }

  function showLoadError(error) {
    console.error('Could not load material issue vouchers.', error);
    if (message) {
      message.textContent = 'Saved vouchers could not be loaded. Please check browser storage and refresh the page.';
      message.hidden = false;
      message.setAttribute('role', 'alert');
    }
    [[allBody, 7], [pendingBody, 6]].forEach(([body, columnCount]) => {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = columnCount;
      cell.textContent = 'Unable to load vouchers.';
      row.append(cell);
      body.replaceChildren(row);
    });
    if (countSpan) countSpan.textContent = '0';
    if (pendingCountSpan) pendingCountSpan.textContent = '0';
  }

  function render() {
    let vouchers;
    try {
      vouchers = readVouchers();
    } catch (error) {
      showLoadError(error);
      return;
    }

    if (message) {
      const params = new URLSearchParams(window.location.search);
      const savedDocNo = params.get('saved');
      const authorizedDocNo = params.get('authorized');
      message.setAttribute('role', 'status');
      if (authorizedDocNo) {
        message.textContent = `Voucher ${authorizedDocNo} has been authorized and moved to All Vouchers.`;
        message.hidden = false;
      } else if (savedDocNo) {
        const savedVoucher = vouchers.find((voucher) => String(voucher.docNo) === savedDocNo);
        message.textContent = savedVoucher && isApproved(savedVoucher)
          ? `Voucher ${savedDocNo} was saved in All Vouchers.`
          : `Voucher ${savedDocNo} was saved and remains pending authorization.`;
        message.hidden = false;
      } else {
        message.textContent = '';
        message.hidden = true;
      }
    }

    const authorized = vouchers.filter(isApproved);
    const pending = vouchers.filter(isPending);

    allBody.innerHTML = authorized.length ? authorized.map((v, index) => `
      <tr data-doc-no="${IMS.esc(v.docNo)}">
        <td>${index + 1}</td>
        <td>${IMS.esc(v.docNo)}</td>
        <td>${IMS.fmtDate(v.date)}</td>
        <td>${IMS.esc(v.department)}</td>
        <td>${IMS.esc(v.requestedBy)}</td>
        <td><span class="status-badge">Authorized</span></td>
        <td><button class="action-btn" type="button" data-open-doc="${IMS.esc(v.docNo)}" data-return-to="all">View</button></td>
      </tr>
    `).join('') : '<tr><td colspan="7">No authorized vouchers found.</td></tr>';

    if (countSpan) countSpan.textContent = String(authorized.length);
    if (pendingCountSpan) pendingCountSpan.textContent = String(pending.length);

    pendingBody.innerHTML = pending.length ? pending.map((v, index) => `
      <tr data-doc-no="${IMS.esc(v.docNo)}">
        <td>${index + 1}</td>
        <td>${IMS.esc(v.docNo)}</td>
        <td>${IMS.fmtDate(v.date)}</td>
        <td>${IMS.esc(v.department)}</td>
        <td>${IMS.esc(v.requestedBy)}</td>
        <td><button class="action-btn" type="button" data-open-doc="${IMS.esc(v.docNo)}" data-return-to="pending">Open MR Voucher</button></td>
      </tr>
    `).join('') : '<tr><td colspan="6">No pending vouchers.</td></tr>';
  }

  tabAll.addEventListener('click', () => {
    setActiveView('all', true);
  });

  tabPending.addEventListener('click', () => {
    setActiveView('pending', true);
  });

  allBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-doc]');
    if (button) openVoucher(button.dataset.openDoc, button.dataset.returnTo || 'all');
  });

  pendingBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-doc]');
    if (button) openVoucher(button.dataset.openDoc, button.dataset.returnTo || 'pending');
  });

  const initialView = new URLSearchParams(window.location.search).get('view') === 'pending' ? 'pending' : 'all';
  setActiveView(initialView);
  render();
});
