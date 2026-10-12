document.addEventListener('DOMContentLoaded', function () {
  const workflowTable = document.getElementById('workflowTableBody');
  if (!workflowTable) return;
  IMS.setEmployeeOptions(document.getElementById('requestedBy'));

  const workflows = [
    { id: 'WF-201', title: 'Vendor Selection', owner: 'Procurement', status: 'Open' },
    { id: 'WF-202', title: 'Price Review', owner: 'Finance', status: 'In Progress' },
    { id: 'WF-203', title: 'Approval', owner: 'Manager', status: 'Pending' }
  ];

  workflowTable.innerHTML = workflows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${row.id}</td>
      <td>${row.title}</td>
      <td>${row.owner}</td>
      <td>${row.status}</td>
      <td><button class="table-action">Open</button></td>
    </tr>
  `).join('');
});
