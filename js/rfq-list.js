document.addEventListener('DOMContentLoaded', function () {
  const tableBody = document.getElementById('rfqTableBody');
  if (!tableBody) return;

  const rfqs = [
    { no: 'RFQ-110', supplier: 'Alpha Supply', date: '2026-10-01', status: 'Open' },
    { no: 'RFQ-111', supplier: 'Beta Traders', date: '2026-10-04', status: 'Quoted' },
    { no: 'RFQ-112', supplier: 'Gamma Works', date: '2026-10-07', status: 'Closed' }
  ];

  tableBody.innerHTML = rfqs.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${row.no}</td>
      <td>${row.date}</td>
      <td>${row.supplier}</td>
      <td>${row.status}</td>
      <td><button class="table-action">View</button></td>
    </tr>
  `).join('');
});
