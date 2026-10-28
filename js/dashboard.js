document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const errorBox = $('dashboardError');
  const menuButton = $('dashboardMenuBtn');
  const sidebar = $('dashboardSidebar');
  const backdrop = $('dashboardBackdrop');

  if (!window.IMS || !errorBox || !menuButton || !sidebar || !backdrop) {
    console.error('Dashboard: required page elements or IMS data helpers are missing.');
    return;
  }

  const esc = IMS.esc;
  const colors = ['#2582f6', '#805cf1', '#ff9a37', '#13ba83', '#91a4bf'];
  const approvedStatuses = new Set(['approved', 'authorized', 'issued', 'completed']);
  const closedStatuses = new Set(['approved', 'authorized', 'issued', 'completed', 'rejected', 'cancelled', 'canceled', 'void', 'closed']);
  const number = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const quantityOfLines = (lines, fields = ['qty', 'quantity', 'receivedQty']) =>
    (Array.isArray(lines) ? lines : []).reduce((total, line) => {
      for (const field of fields) {
        if (line?.[field] !== undefined && line[field] !== null && line[field] !== '') {
          return total + Math.max(0, number(line[field]));
        }
      }
      return total;
    }, 0);
  const statusOf = (record) => String(record?.authorizationStatus || record?.status || record?.linkStatus || 'Pending').trim();
  const isApproved = (record) => approvedStatuses.has(statusOf(record).toLocaleLowerCase());
  const isPending = (record) => !closedStatuses.has(statusOf(record).toLocaleLowerCase());
  const dateValue = (value) => {
    const text = String(value || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(`${text}T00:00:00`);
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const fmtDate = (value) => {
    const date = dateValue(value);
    return date ? new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date) : '—';
  };
  const escapeHtml = (value) => esc(String(value ?? ''));
  const money = (value) => `₹ ${number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const showEmpty = (columns, text) => `<tr><td class="dashboard-empty" colspan="${columns}">${escapeHtml(text)}</td></tr>`;

  function readArray(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) throw new TypeError(`Saved ${key} data must be an array.`);
    return value.filter((record) => record && typeof record === 'object' && !Array.isArray(record));
  }

  function readItems() {
    const stored = [...readArray('ims_items'), ...readArray('softManagerItems')];
    const byCode = new Map();
    stored.forEach((item) => {
      const code = String(item.code || item.itemCode || item.id || '');
      if (!code) return;
      byCode.set(code, {
        ...item,
        code,
        name: String(item.name || item.itemName || ''),
        category: String(item.category || item.department || ''),
        department: String(item.department || item.category || ''),
        stock: number(item.stock),
        reorder: number(item.reorder)
      });
    });
    return [...byCode.values()];
  }

  function updateSummary(data) {
    const { indents, rfqs, quotations, orders, receipts, issues } = data;
    const pendingAuthorization = orders.filter((order) =>
      !['authorized', 'approved', 'completed', 'cancelled', 'rejected'].includes(statusOf(order).toLocaleLowerCase())
    );
    const orderValue = orders.reduce((sum, order) => sum + number(order.total), 0);
    const receiptQuantity = receipts.reduce((sum, receipt) =>
      sum + quantityOfLines(receipt.lines, ['receivedQty', 'qty']), 0);
    const authorizedIssues = issues.filter(isApproved);
    const issueQuantity = authorizedIssues.reduce((sum, issue) =>
      sum + quantityOfLines(issue.items), 0);

    $('kpiIndents').textContent = String(indents.length);
    $('kpiIndentsPending').textContent = `${indents.filter(isPending).length} pending`;
    $('kpiRfqs').textContent = String(rfqs.length);
    $('kpiRfqsPending').textContent = `${rfqs.filter(isPending).length} pending`;
    $('kpiQuotations').textContent = String(quotations.length);
    $('kpiOrders').textContent = String(orders.length);
    $('kpiOrderValue').textContent = `${money(orderValue)} total value`;
    $('kpiAuthorization').textContent = String(pendingAuthorization.length);
    $('kpiReceipts').textContent = String(receipts.length);
    $('kpiReceiptQty').textContent = `${receiptQuantity.toLocaleString()} units received`;
    $('kpiIssues').textContent = String(authorizedIssues.length);
    $('kpiIssueQty').textContent = `${issueQuantity.toLocaleString()} units authorized`;
    $('flowIndentCount').textContent = `${indents.length} records`;
    $('flowRfqCount').textContent = `${rfqs.length} records`;
    $('flowQuotationCount').textContent = `${quotations.length} received`;
    $('flowOrderCount').textContent = `${orders.length} orders`;
    $('flowAuthorizationCount').textContent = `${pendingAuthorization.length} pending`;
    $('flowReceiptCount').textContent = `${receipts.length} receipts`;
  }

  function renderWarehouses(receipts) {
    const registered = readArray('ims_warehouses').map((warehouse) =>
      typeof warehouse === 'string' ? { name: warehouse } : warehouse
    );
    const receiptTotals = new Map();
    receipts.forEach((receipt) => {
      const name = String(receipt.warehouse || '').trim();
      if (!name) return;
      receiptTotals.set(name, (receiptTotals.get(name) || 0) + quantityOfLines(receipt.lines, ['receivedQty', 'qty']));
    });

    const names = new Set([
      ...registered.map((warehouse) => String(warehouse?.name || '').trim()).filter(Boolean),
      ...receiptTotals.keys()
    ]);
    const list = [...names].map((name) => ({
      name,
      quantity: receiptTotals.get(name) || 0
    })).sort((left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name)).slice(0, 5);

    $('warehouseOverview').innerHTML = list.length ? list.map((warehouse) => `
      <div class="warehouse-row">
        <span class="warehouse-icon"><i class="fa-solid fa-warehouse" aria-hidden="true"></i></span>
        <span class="warehouse-meta"><strong>${escapeHtml(warehouse.name)}</strong><small>Recorded material receipts</small></span>
        <span class="warehouse-count">${warehouse.quantity.toLocaleString()}<small>units in</small></span>
      </div>`).join('') : showEmpty(1, 'No warehouses or receipts have been recorded.');
  }

  function renderCategories(items) {
    const totals = new Map();
    items.forEach((item) => {
      const category = String(item.category || item.department || 'Uncategorized').trim() || 'Uncategorized';
      totals.set(category, (totals.get(category) || 0) + Math.max(0, number(item.stock)));
    });

    const allCategories = [...totals].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    const primary = allCategories.slice(0, 4);
    if (allCategories.length > 4) {
      primary.push(['Other', allCategories.slice(4).reduce((sum, [, quantity]) => sum + quantity, 0)]);
    }

    const stockTotal = allCategories.reduce((sum, [, quantity]) => sum + quantity, 0);
    $('categoryTotal').textContent = stockTotal.toLocaleString();
    const segments = [];
    let cursor = 0;
    primary.forEach(([, quantity], index) => {
      const share = stockTotal > 0 ? quantity / stockTotal * 100 : 0;
      if (share <= 0) return;
      segments.push(`${colors[index % colors.length]} ${cursor}% ${cursor + share}%`);
      cursor += share;
    });
    const donut = $('categoryDonut');
    donut.style.background = segments.length ? `conic-gradient(${segments.join(', ')})` : 'conic-gradient(#e9eef5 0 100%)';
    donut.setAttribute('aria-label', `Inventory stock total ${stockTotal} units, grouped into ${primary.length} categories.`);
    $('categoryLegend').innerHTML = primary.length ? primary.map(([name, quantity], index) => `
      <div class="category-legend-row">
        <i class="category-swatch" style="--category-color:${colors[index % colors.length]}" aria-hidden="true"></i>
        <span>${escapeHtml(name)}</span>
        <strong>${stockTotal ? `${Math.round(quantity / stockTotal * 100)}%` : '0%'}</strong>
      </div>`).join('') : '<span class="dashboard-empty">No item categories recorded.</span>';
  }

  function movementData(receipts, issues) {
    const days = [];
    const totals = new Map();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - offset);
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push({ date, iso });
      totals.set(iso, { inward: 0, outward: 0 });
    }

    receipts.forEach((receipt) => {
      const day = totals.get(String(receipt.date || '').slice(0, 10));
      if (day) day.inward += quantityOfLines(receipt.lines, ['receivedQty', 'qty']);
    });
    issues.filter(isApproved).forEach((issue) => {
      const day = totals.get(String(issue.date || '').slice(0, 10));
      if (day) day.outward += quantityOfLines(issue.items);
    });

    const max = Math.max(1, ...[...totals.values()].flatMap((entry) => [entry.inward, entry.outward]));
    $('movementChart').innerHTML = days.map(({ date, iso }) => {
      const day = totals.get(iso);
      const incomingHeight = day.inward ? Math.max(3, day.inward / max * 100) : 2;
      const outgoingHeight = day.outward ? Math.max(3, day.outward / max * 100) : 2;
      const label = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
      return `<div class="movement-day" title="${escapeHtml(label)} · Inward ${day.inward} · Outward ${day.outward}">
        <div class="movement-bars">
          <span class="movement-bar" style="height:${incomingHeight}%" aria-label="Inward ${day.inward}"></span>
          <span class="movement-bar outward" style="height:${outgoingHeight}%" aria-label="Outward ${day.outward}"></span>
        </div><small>${escapeHtml(new Intl.DateTimeFormat(undefined, { day: '2-digit' }).format(date))}</small>
      </div>`;
    }).join('');
  }

  function documentRecords(data) {
    const records = [];
    data.indents.forEach((record) => records.push({
      no: record.docNo || record.no,
      type: 'Indent',
      party: record.requestedBy || record.department || '',
      date: record.date || record.createdDate,
      value: `${quantityOfLines(record.items).toLocaleString()} qty`,
      status: statusOf(record),
      href: `voucher-create.html?docNo=${encodeURIComponent(record.docNo || '')}&returnTo=all`
    }));
    data.rfqs.forEach((record) => records.push({
      no: record.no,
      type: 'RFQ',
      party: record.supplier || record.piNo || '',
      date: record.date,
      value: `${quantityOfLines(record.lines).toLocaleString()} qty`,
      status: statusOf(record),
      href: 'request-for-quotation.html'
    }));
    data.quotations.forEach((record) => records.push({
      no: record.no,
      type: 'Quotation',
      party: record.supplier || '',
      date: record.date,
      value: money(record.total),
      status: statusOf(record),
      href: 'quotation-receive.html'
    }));
    data.orders.forEach((record) => records.push({
      no: record.no,
      type: 'Purchase Order',
      party: record.supplier || '',
      date: record.date,
      value: money(record.total),
      status: record.authorizationStatus || record.status || 'Pending',
      href: `purchase-order-creation.html?orderId=${encodeURIComponent(record.id || '')}`
    }));
    data.receipts.forEach((record) => records.push({
      no: record.no,
      type: 'Receipt',
      party: record.supplier || '',
      date: record.date,
      value: `${quantityOfLines(record.lines, ['receivedQty', 'qty']).toLocaleString()} qty`,
      status: record.status || 'Received',
      href: 'material-receipt-note.html'
    }));
    data.issues.forEach((record) => records.push({
      no: record.docNo || record.no,
      type: 'Material Issue',
      party: record.department || record.requestedBy || '',
      date: record.date,
      value: `${quantityOfLines(record.items).toLocaleString()} qty`,
      status: statusOf(record),
      href: `voucher-create.html?docNo=${encodeURIComponent(record.docNo || '')}&returnTo=all`
    }));
    return records.sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')));
  }

  function statusClass(status) {
    const normalized = String(status || '').toLocaleLowerCase();
    if (['approved', 'authorized', 'received', 'completed', 'closed', 'issued'].some((word) => normalized.includes(word))) return 'status-complete';
    if (['partial', 'quotation', 'rfq'].some((word) => normalized.includes(word))) return 'status-warning';
    if (['reject', 'cancel', 'void'].some((word) => normalized.includes(word))) return 'status-danger';
    if (normalized.includes('pending')) return 'status-pending';
    return 'status-neutral';
  }

  function renderDocuments(data) {
    const rows = documentRecords(data).slice(0, 7);
    $('recentDocumentsBody').innerHTML = rows.length ? rows.map((record) => `
      <tr>
        <td><a class="dashboard-document-link" href="${record.href}">${escapeHtml(record.no || '—')}</a></td>
        <td><span class="dashboard-type">${escapeHtml(record.type)}</span></td>
        <td>${escapeHtml(record.party || '—')}</td>
        <td>${escapeHtml(fmtDate(record.date))}</td>
        <td>${escapeHtml(record.value)}</td>
        <td><span class="dashboard-status ${statusClass(record.status)}">${escapeHtml(record.status)}</span></td>
        <td><a class="dashboard-row-action" href="${record.href}" aria-label="Open ${escapeHtml(record.no || record.type)}"><i class="fa-solid fa-arrow-up-right-from-square"></i></a></td>
      </tr>`).join('') : showEmpty(7, 'No documents are available yet.');
  }

  function renderLowStock(items) {
    const lowStock = items.filter((item) => number(item.reorder) > 0 && number(item.stock) <= number(item.reorder))
      .sort((left, right) => number(left.stock) - number(right.stock))
      .slice(0, 7);
    $('lowStockBody').innerHTML = lowStock.length ? lowStock.map((item) => `
      <tr>
        <td>${escapeHtml(item.code)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${number(item.stock).toLocaleString()}</td>
        <td>${number(item.reorder).toLocaleString()}</td>
      </tr>`).join('') : showEmpty(4, 'No items are at or below their reorder level.');
  }

  function renderReceipts(receipts) {
    const recent = [...receipts].sort((left, right) => String(right.date || '').localeCompare(String(left.date || ''))).slice(0, 5);
    $('recentReceiptsBody').innerHTML = recent.length ? recent.map((receipt) => `
      <tr>
        <td>${escapeHtml(receipt.no || '—')}</td>
        <td>${escapeHtml(receipt.supplier || '—')}</td>
        <td>${escapeHtml(receipt.poNo || '—')}</td>
        <td>${escapeHtml(fmtDate(receipt.date))}</td>
        <td>${quantityOfLines(receipt.lines, ['receivedQty', 'qty']).toLocaleString()}</td>
      </tr>`).join('') : showEmpty(5, 'No material receipts recorded.');
  }

  function renderIssues(issues) {
    const recent = issues.filter(isApproved)
      .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
      .slice(0, 5);
    $('recentIssuesBody').innerHTML = recent.length ? recent.map((issue) => `
      <tr>
        <td>${escapeHtml(issue.docNo || issue.no || '—')}</td>
        <td>${escapeHtml(issue.department || '—')}</td>
        <td>${escapeHtml(fmtDate(issue.date))}</td>
        <td>${quantityOfLines(issue.items).toLocaleString()}</td>
        <td><span class="dashboard-status status-complete">${escapeHtml(statusOf(issue))}</span></td>
      </tr>`).join('') : showEmpty(5, 'No authorized material issues recorded.');
  }

  function render() {
    try {
      const data = {
        indents: IMS.piAll(),
        rfqs: IMS.rfqAll(),
        quotations: IMS.qrAll(),
        orders: IMS.purchaseOrders(),
        receipts: IMS.mrnAll(),
        issues: readArray('materialRequisitionVouchers'),
        items: readItems()
      };
      const invalidArray = Object.entries(data).find(([, records]) => !Array.isArray(records));
      if (invalidArray) throw new TypeError(`Saved ${invalidArray[0]} data must be an array.`);

      updateSummary(data);
      renderWarehouses(data.receipts);
      renderCategories(data.items);
      movementData(data.receipts, data.issues);
      renderDocuments(data);
      renderLowStock(data.items);
      renderReceipts(data.receipts);
      renderIssues(data.issues);
      errorBox.hidden = true;
      errorBox.textContent = '';
    } catch (error) {
      console.error('Could not load dashboard data.', error);
      errorBox.textContent = `Some dashboard data could not be loaded: ${error.message}`;
      errorBox.hidden = false;
    }
  }

  menuButton.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 920px)').matches) {
      const isOpen = document.body.classList.toggle('is-sidebar-open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
    } else {
      const isCollapsed = document.body.classList.toggle('is-sidebar-collapsed');
      menuButton.setAttribute('aria-expanded', String(!isCollapsed));
    }
  });
  backdrop.addEventListener('click', () => {
    document.body.classList.remove('is-sidebar-open');
    menuButton.setAttribute('aria-expanded', 'false');
  });

  const isMobileNavigation = () => window.matchMedia('(max-width: 920px)').matches;
  menuButton.setAttribute('aria-expanded', String(!isMobileNavigation()));
  window.addEventListener('resize', () => {
    if (isMobileNavigation()) document.body.classList.remove('is-sidebar-collapsed');
    else document.body.classList.remove('is-sidebar-open');
    menuButton.setAttribute('aria-expanded', String(
      isMobileNavigation()
        ? document.body.classList.contains('is-sidebar-open')
        : !document.body.classList.contains('is-sidebar-collapsed')
    ));
  });

  document.addEventListener('click', (event) => {
    if (isMobileNavigation()
        && document.body.classList.contains('is-sidebar-open')
        && !sidebar.contains(event.target) && !menuButton.contains(event.target)) {
      document.body.classList.remove('is-sidebar-open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      $('searchBox')?.focus();
    }
  });

  const today = new Date();
  $('dashboardToday').textContent = new Intl.DateTimeFormat(undefined, {
    month: 'short', day: '2-digit', year: 'numeric'
  }).format(today);

  window.addEventListener('storage', render);
  render();
});
