document.addEventListener('DOMContentLoaded', () => {
  const monthInput = document.getElementById('registerMonth');
  const printButton = document.getElementById('printRegisterBtn');
  const requisitionBody = document.getElementById('requisitionRegisterBody');
  const purchaseOrderBody = document.getElementById('purchaseOrderRegisterBody');
  const requisitionView = document.getElementById('materialRequisitionRegister');
  const purchaseOrderView = document.getElementById('purchaseOrderRegister');
  const requisitionTab = document.getElementById('tabMaterialRequisition');
  const purchaseOrderTab = document.getElementById('tabPurchaseOrder');
  const message = document.getElementById('registerMessage');

  if (!monthInput || !printButton || !requisitionBody || !purchaseOrderBody
      || !requisitionView || !purchaseOrderView || !requisitionTab || !purchaseOrderTab || !message
      || !window.IMS) {
    console.error('Registers: required page elements or IMS data helpers are missing.');
    return;
  }

  const esc = IMS.esc;
  const currentDate = new Date();
  monthInput.value = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  function monthLabel(value) {
    if (!value) return 'Select a month';
    const [year, month] = value.split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
      .format(new Date(year, month - 1, 1));
  }

  function dateInMonth(value, month) {
    return typeof value === 'string' && /^\d{4}-\d{2}/.test(value)
      && value.slice(0, 7) === month;
  }

  function showError(error) {
    console.error('Could not load monthly registers.', error);
    message.textContent = `Could not load the register data: ${error.message}`;
    message.hidden = false;
    message.classList.add('error');
    requisitionBody.innerHTML = '<tr><td colspan="10">Unable to load material requisitions.</td></tr>';
    purchaseOrderBody.innerHTML = '<tr><td colspan="10">Unable to load purchase orders.</td></tr>';
    document.getElementById('requisitionCount').textContent = '0';
    document.getElementById('requisitionQuantity').textContent = '0';
    document.getElementById('purchaseOrderCount').textContent = '0';
    document.getElementById('purchaseOrderAmount').textContent = '0.00';
  }

  function renderRequisitions(month) {
    const raw = localStorage.getItem('materialRequisitionVouchers');
    const vouchers = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(vouchers)) throw new TypeError('Saved material requisitions must be a list.');
    const filtered = vouchers.filter((voucher) =>
      voucher && typeof voucher === 'object' && dateInMonth(voucher.date, month)
    ).sort((left, right) => String(left.date).localeCompare(String(right.date))
      || String(left.docNo).localeCompare(String(right.docNo)));

    let quantityTotal = 0;
    requisitionBody.innerHTML = filtered.length ? filtered.map((voucher, index) => {
      const items = Array.isArray(voucher.items) ? voucher.items : [];
      const quantity = items.reduce((sum, item) => sum + (Number(item?.qty ?? item?.quantity) || 0), 0);
      quantityTotal += quantity;
      const status = String(voucher.authorizationStatus || voucher.status || 'Pending');
      return `<tr>
        <td>${index + 1}</td>
        <td>${esc(IMS.fmtDate(voucher.date))}</td>
        <td>${esc(voucher.docNo || '')}</td>
        <td>${esc(voucher.warehouse || '')}</td>
        <td>${esc(voucher.department || '')}</td>
        <td>${esc(voucher.requestedBy || '')}</td>
        <td>${items.length}</td>
        <td>${quantity}</td>
        <td>${esc(status)}</td>
        <td><button class="action-btn has-label register-open-button" type="button" data-open-requisition="${esc(voucher.docNo || '')}">Open</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="10">No material requisitions for this month.</td></tr>';
    document.getElementById('requisitionCount').textContent = String(filtered.length);
    document.getElementById('requisitionQuantity').textContent = String(quantityTotal);
  }

  function renderPurchaseOrders(month) {
    const filtered = IMS.purchaseOrders().filter((order) =>
      order && typeof order === 'object' && dateInMonth(order.date, month)
    ).sort((left, right) => String(left.date).localeCompare(String(right.date))
      || String(left.no).localeCompare(String(right.no)));

    const total = filtered.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    purchaseOrderBody.innerHTML = filtered.length ? filtered.map((order, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(IMS.fmtDate(order.date))}</td>
        <td>${esc(order.no || '')}</td>
        <td>${esc(order.supplier || '')}</td>
        <td>${esc(order.quotationNo || '')}</td>
        <td>${Array.isArray(order.lines) ? order.lines.length : 0}</td>
        <td>${(Number(order.total) || 0).toFixed(2)}</td>
        <td>${esc(order.status || '')}</td>
        <td>${esc(order.authorizationStatus || 'Pending Authorization')}</td>
        <td><button class="action-btn has-label register-open-button" type="button" data-open-purchase-order="${esc(order.id || '')}">Open</button></td>
      </tr>`).join('') : '<tr><td colspan="10">No purchase orders for this month.</td></tr>';
    document.getElementById('purchaseOrderCount').textContent = String(filtered.length);
    document.getElementById('purchaseOrderAmount').textContent = total.toFixed(2);
  }

  function render() {
    if (!monthInput.value) {
      message.textContent = 'Select a month to view its reports.';
      message.hidden = false;
      return;
    }
    message.hidden = true;
    message.classList.remove('error');
    document.querySelectorAll('[data-register-period]').forEach((element) => {
      element.textContent = monthLabel(monthInput.value);
    });
    try {
      renderRequisitions(monthInput.value);
      renderPurchaseOrders(monthInput.value);
    } catch (error) {
      showError(error);
    }
  }

  function setActiveRegister(type) {
    const showRequisitions = type === 'requisition';
    requisitionTab.classList.toggle('active', showRequisitions);
    purchaseOrderTab.classList.toggle('active', !showRequisitions);
    requisitionTab.setAttribute('aria-selected', String(showRequisitions));
    purchaseOrderTab.setAttribute('aria-selected', String(!showRequisitions));
    requisitionView.hidden = !showRequisitions;
    purchaseOrderView.hidden = showRequisitions;
  }

  requisitionTab.addEventListener('click', () => setActiveRegister('requisition'));
  purchaseOrderTab.addEventListener('click', () => setActiveRegister('purchase-order'));
  monthInput.addEventListener('change', render);
  printButton.addEventListener('click', () => {
    const activeView = requisitionView.hidden ? purchaseOrderView : requisitionView;
    activeView.classList.add('is-printing');
    window.addEventListener('afterprint', () => activeView.classList.remove('is-printing'), { once: true });
    window.print();
  });

  requisitionBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-requisition]');
    if (!button) return;
    const params = new URLSearchParams({ docNo: button.dataset.openRequisition, returnTo: 'all' });
    window.location.href = `voucher-create.html?${params.toString()}`;
  });
  purchaseOrderBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-purchase-order]');
    if (!button) return;
    const params = new URLSearchParams({ orderId: button.dataset.openPurchaseOrder });
    window.location.href = `purchase-order-creation.html?${params.toString()}`;
  });

  window.addEventListener('storage', render);
  render();
});
