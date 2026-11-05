(() => {
  'use strict';
  const storageKey = 'ims-workspace-v1';
  const initialState = {
    items: [
      { id: 'ITM-1001', name: 'Safety Gloves', stock: 18, reorder: 25 },
      { id: 'ITM-1002', name: 'LED Work Light', stock: 7, reorder: 10 },
      { id: 'ITM-1003', name: 'Cleaning Solution', stock: 42, reorder: 20 },
      { id: 'ITM-1004', name: 'Printer Paper (A4)', stock: 12, reorder: 30 }
    ],
    requisitions: [{ id: 'REQ-1001', requestor: 'Arjun Mehta', department: 'Facilities', item: 'Safety Gloves', quantity: 8, notes: 'For maintenance team', status: 'Pending' }],
    orders: [{ id: 'PO-1001', supplier: 'Northstar Supplies', item: 'Printer Paper (A4)', quantity: 50, expectedDate: '2026-11-12', status: 'Open' }]
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const getState = () => { try { return JSON.parse(localStorage.getItem(storageKey)) || clone(initialState); } catch { return clone(initialState); } };
  let state = getState();
  const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const nextId = (prefix, records) => `${prefix}-${1001 + records.length}`;

  function renderSelects() {
    const options = state.items.map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)} (${escapeHtml(item.id)})</option>`).join('');
    document.querySelectorAll('.item-select, #itemSelect').forEach(select => { select.innerHTML = `<option value="">Select an item</option>${options}`; });
  }
  function renderDashboard() {
    const lowStock = state.items.filter(item => item.stock <= item.reorder);
    document.querySelector('#metrics').innerHTML = [
      ['Items tracked', state.items.length], ['Below reorder level', lowStock.length], ['Pending requisitions', state.requisitions.filter(r => r.status === 'Pending').length], ['Open purchase orders', state.orders.filter(o => o.status === 'Open').length]
    ].map(([label, value]) => `<article class="metric"><p>${label}</p><strong>${value}</strong></article>`).join('');
    document.querySelector('#stockBody').innerHTML = state.items.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.id)}</td><td>${item.stock}</td><td>${item.reorder}</td><td><span class="status ${item.stock <= item.reorder ? 'status-warning' : 'status-good'}">${item.stock <= item.reorder ? 'Reorder' : 'Healthy'}</span></td></tr>`).join('');
  }
  function emptyOrMarkup(records, markup) { return records.length ? records.map(markup).join('') : document.querySelector('#emptyState').content.firstElementChild.outerHTML; }
  function renderRequisitions() {
    const pending = state.requisitions.filter(request => request.status === 'Pending');
    document.querySelector('#pendingRequests').innerHTML = emptyOrMarkup(pending, request => `<article class="request"><div class="request-top"><div><h3>${escapeHtml(request.id)} · ${escapeHtml(request.item)}</h3><p>${request.quantity} requested by ${escapeHtml(request.requestor)} · ${escapeHtml(request.department)}</p></div><span class="status status-warning">Pending</span></div><button class="button" type="button" data-approve="${escapeHtml(request.id)}">Approve & issue</button></article>`);
  }
  function renderOrders() {
    const open = state.orders.filter(order => order.status === 'Open');
    document.querySelector('#openOrders').innerHTML = emptyOrMarkup(open, order => `<article class="request"><div class="request-top"><div><h3>${escapeHtml(order.id)} · ${escapeHtml(order.supplier)}</h3><p>${order.quantity} × ${escapeHtml(order.item)} · Expected ${escapeHtml(order.expectedDate)}</p></div><span class="status status-warning">Open</span></div><button class="button" type="button" data-receive="${escapeHtml(order.id)}">Receive order</button></article>`);
  }
  function render() { renderSelects(); renderDashboard(); renderRequisitions(); renderOrders(); }
  function showRoute() {
    const hash = location.hash || '#dashboard';
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', `#${view.id}` === hash));
  }
  function setMessage(id, text) { document.querySelector(id).textContent = text; }

  document.querySelector('#requisitionForm').addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    state.requisitions.unshift({ id: nextId('REQ', state.requisitions), requestor: data.get('requestor').trim(), department: data.get('department').trim(), item: data.get('item'), quantity: Number(data.get('quantity')), notes: data.get('notes').trim(), status: 'Pending' });
    save(); event.currentTarget.reset(); render(); setMessage('#requisitionMessage', 'Requisition submitted for approval.');
  });
  document.querySelector('#orderForm').addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    state.orders.unshift({ id: nextId('PO', state.orders), supplier: data.get('supplier').trim(), item: data.get('item'), quantity: Number(data.get('quantity')), expectedDate: data.get('expectedDate'), status: 'Open' });
    save(); event.currentTarget.reset(); render(); setMessage('#orderMessage', 'Purchase order created.');
  });
  document.addEventListener('click', event => {
    const approve = event.target.closest('[data-approve]'); const receive = event.target.closest('[data-receive]');
    if (approve) { const request = state.requisitions.find(entry => entry.id === approve.dataset.approve); const item = state.items.find(entry => entry.name === request.item); request.status = 'Issued'; item.stock = Math.max(0, item.stock - request.quantity); save(); render(); }
    if (receive) { const order = state.orders.find(entry => entry.id === receive.dataset.receive); const item = state.items.find(entry => entry.name === order.item); order.status = 'Received'; item.stock += order.quantity; save(); render(); }
  });
  document.querySelector('#resetData').addEventListener('click', () => { state = clone(initialState); save(); render(); setMessage('#requisitionMessage', 'Demo data has been reset.'); });
  window.addEventListener('hashchange', showRoute);
  document.querySelector('#orderForm [name="expectedDate"]').value = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  render(); showRoute();
})();
