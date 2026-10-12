document.addEventListener('DOMContentLoaded', function () {
  const tableBody = document.getElementById('authorizeTableBody');
  const searchInput = document.getElementById('authorizeSearch');
  const countLabel = document.getElementById('authorizeCount');
  if (!tableBody) return;

  const fallbackRecords = [
    {
      docNo: 'MRIU/26-27/01308',
      date: '2026-10-10',
      warehouse: '',
      location: 'Umbrella Facility Management Services Pvt Ltd',
      department: 'Civil',
      requestedBy: 'User',
      status: 'Pending'
    },
    {
      docNo: 'MRIU/26-27/01309',
      date: '2026-10-11',
      warehouse: '',
      location: 'Site A',
      department: 'MEP',
      requestedBy: 'Rakesh',
      status: 'Pending'
    },
    {
      docNo: 'MRIU/26-27/01310',
      date: '2026-10-12',
      warehouse: '',
      location: 'Site B',
      department: 'Housekeeping',
      requestedBy: 'Priya',
      status: 'Review'
    }
  ];

  function readVouchers() {
    try {
      const stored = JSON.parse(localStorage.getItem('materialRequisitionVouchers') || '[]');
      if (!Array.isArray(stored)) return fallbackRecords;
      return stored.length ? stored : fallbackRecords;
    } catch (error) {
      console.error('Could not load vouchers for authorization.', error);
      return fallbackRecords;
    }
  }

  function normalizeRecord(voucher) {
    return {
      docNo: voucher.docNo || voucher.reqId || 'MR-0000',
      date: voucher.date || voucher.createdDate || '2026-10-10',
      warehouse: voucher.warehouse || '',
      location: voucher.location || 'Umbrella Facility Management Services Pvt Ltd',
      department: voucher.department || 'General',
      requestedBy: voucher.requestedBy || voucher.createdBy || 'User',
      status: String(voucher.authorizationStatus || voucher.status || 'Pending').trim() || 'Pending'
    };
  }

  function renderRows(records) {
    const pendingRecords = records.filter((row) => {
      const status = String(row.status || '').toLowerCase();
      return status !== 'approved' && status !== 'rejected' && status !== 'completed';
    });

    if (countLabel) {
      countLabel.textContent = `${pendingRecords.length} voucher${pendingRecords.length === 1 ? '' : 's'} pending authorization`;
    }

    tableBody.innerHTML = pendingRecords.map((row, index) => `
      <tr data-open-doc="${String(row.docNo).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" title="Double-click to open this voucher">
        <td><input type="checkbox" aria-label="Select voucher ${row.docNo}" /></td>
        <td>${row.docNo}</td>
        <td>${row.date}</td>
        <td>${row.warehouse}</td>
        <td>${row.location}</td>
        <td>${row.department}</td>
        <td>${row.requestedBy}</td>
        <td>${row.status}</td>
      </tr>
    `).join('');
  }

  function filterRecords() {
    const query = (searchInput?.value || '').trim().toLowerCase();
    const allRecords = readVouchers().map(normalizeRecord);
    const filtered = !query
      ? allRecords
      : allRecords.filter((row) => [
          row.docNo,
          row.date,
          row.warehouse,
          row.location,
          row.department,
          row.requestedBy,
          row.status
        ].join(' ').toLowerCase().includes(query));

    renderRows(filtered);
  }

  searchInput?.addEventListener('input', filterRecords);
  tableBody.addEventListener('dblclick', (event) => {
    const row = event.target.closest('[data-open-doc]');
    if (row) window.location.href = `voucher-create.html?docNo=${encodeURIComponent(row.dataset.openDoc)}`;
  });
  filterRecords();
});
