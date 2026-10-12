document.addEventListener('DOMContentLoaded', function () {
  const tableBody = document.getElementById('orderTableBody');
  if (!tableBody) return;

  const esc = IMS.esc;
  function renderOrders() {
    const orders = IMS.purchaseOrders().slice().reverse();
    tableBody.innerHTML = orders.map((row, index) => `
    <tr data-open-order="${esc(row.id)}" title="Double-click to open this voucher">
      <td>${orders.length - index}</td>
      <td>${esc(row.no)}</td>
      <td>${esc(IMS.fmtDate(row.date))}</td>
      <td>${esc(row.supplier)}</td>
      <td>${esc(row.quotationNo)}</td>
      <td>${(Number(row.total) || 0).toFixed(2)}</td>
      <td>${esc(row.status)}</td>
      <td>${Number((row.lines || []).length)}</td>
    </tr>
    `).join('');
  }

  document.getElementById('refreshOrdersBtn')?.addEventListener('click', renderOrders);
  tableBody.addEventListener('dblclick', (event) => {
    const row = event.target.closest('[data-open-order]');
    if (row) window.location.href = `purchase-order-creation.html?orderId=${encodeURIComponent(row.dataset.openOrder)}`;
  });
  renderOrders();
});
