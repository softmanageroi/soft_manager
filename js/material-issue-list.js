document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const allBody = $('issueAllBody');
  const pendingBody = $('issuePendingBody');
  const allView = $('issueAllView');
  const pendingView = $('issuePendingView');
  const tabAll = $('tabAllIssue');
  const tabPending = $('tabPendingIssue');
  const countSpan = $('issueCount');
  const message = $('issueListMessage');
  const listSearch = $('issueListSearch');

  if (!allBody || !pendingBody || !window.IMS) return;

  const VOUCHERS_KEY = 'materialRequisitionVouchers';
  const approvedStatuses = new Set(['approved', 'authorized', 'issued', 'completed']);
  const closedStatuses = new Set([...approvedStatuses, 'rejected', 'cancelled', 'canceled', 'void']);

  function readVouchers() {
    const stored = JSON.parse(localStorage.getItem(VOUCHERS_KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  }

  function voucherStatus(voucher) {
    return String(voucher?.authorizationStatus || voucher?.status || 'Pending').trim() || 'Pending';
  }

  function voucherStatusClass(voucher) {
    const status = voucherStatus(voucher).toLocaleLowerCase();
    if (approvedStatuses.has(status)) return 'status-approved';
    if (isPending(voucher)) return 'status-pending';
    if (['rejected', 'cancelled', 'canceled', 'void'].includes(status)) return 'status-rejected';
    return 'status-neutral';
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

  function setActiveView(view) {
    const isPending = view === 'pending';
    tabAll.classList.toggle('active', !isPending);
    tabPending.classList.toggle('active', isPending);
    allView.hidden = isPending;
    pendingView.hidden = !isPending;
  }

  function render(filter = '') {
    const vouchers = readVouchers();
    const allVouchers = vouchers;
    const pending = vouchers.filter(isPending);

    const filteredAll = allVouchers.filter(v =>
        (v.docNo || '').toLowerCase().includes(filter.toLowerCase()) || 
        (v.department || '').toLowerCase().includes(filter.toLowerCase()) ||
        (v.requestedBy || '').toLowerCase().includes(filter.toLowerCase())
    );

    const filteredPending = pending.filter(v => 
        (v.docNo || '').toLowerCase().includes(filter.toLowerCase()) || 
        (v.department || '').toLowerCase().includes(filter.toLowerCase()) ||
        (v.requestedBy || '').toLowerCase().includes(filter.toLowerCase())
    );

    allBody.innerHTML = filteredAll.length ? filteredAll.map((v, index) => `
      <tr data-doc-no="${IMS.esc(v.docNo)}" style="cursor:pointer">
        <td>${index + 1}</td>
        <td><strong>${IMS.esc(v.docNo)}</strong></td>
        <td>${IMS.fmtDate(v.date)}</td>
        <td>${IMS.esc(v.department)}</td>
        <td>${IMS.esc(v.requestedBy)}</td>
        <td><span class="status-badge ${voucherStatusClass(v)}">${IMS.esc(voucherStatus(v))}</span></td>
        <td style="text-align:center">
            <button class="btn-secondary" style="padding: 4px 12px; font-size: 12px;" type="button" data-open-doc="${IMS.esc(v.docNo)}" data-return-to="all">View</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="7" style="text-align:center; padding: 20px;">No vouchers found.</td></tr>';

    pendingBody.innerHTML = filteredPending.length ? filteredPending.map((v, index) => `
      <tr data-doc-no="${IMS.esc(v.docNo)}" style="cursor:pointer">
        <td>${index + 1}</td>
        <td><strong>${IMS.esc(v.docNo)}</strong></td>
        <td>${IMS.fmtDate(v.date)}</td>
        <td>${IMS.esc(v.department)}</td>
        <td>${IMS.esc(v.requestedBy)}</td>
        <td style="text-align:center">
            <button class="btn-secondary" style="padding: 4px 12px; font-size: 12px;" type="button" data-open-doc="${IMS.esc(v.docNo)}" data-return-to="pending">Open Issue Voucher</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6" style="text-align:center; padding: 20px;">No pending vouchers.</td></tr>';

    if (countSpan) countSpan.textContent = String(filteredAll.length);
  }

  tabAll.addEventListener('click', () => setActiveView('all'));
  tabPending.addEventListener('click', () => setActiveView('pending'));
  
  if (listSearch) {
      listSearch.addEventListener('input', (e) => render(e.target.value));
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open-doc]');
    if (btn) {
        const docNo = btn.dataset.openDoc;
        const returnTo = btn.dataset.returnTo || 'all';
        openVoucher(docNo, returnTo);
    }
  });

  render();
});
