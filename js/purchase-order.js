document.addEventListener('DOMContentLoaded', function () {
  const orderId = document.getElementById('orderId');
  const poNo = document.getElementById('poNo');
  const orderDate = document.getElementById('poDate');
  const sourceQuotation = document.getElementById('workflowSelect');
  const supplierInput = document.getElementById('supplier');
  const supplierAccounts = document.getElementById('supplierAccounts');
  const vendorAccountDetails = document.getElementById('vendorAccountDetails');
  const vendorAccountMessage = document.getElementById('vendorAccountMessage');
  const linesBody = document.getElementById('poLinesBody');
  const totalAmount = document.getElementById('totalAmount');
  const poMessage = document.getElementById('poMessage');
  const allPoView = document.getElementById('allPoView');
  const pendingQrView = document.getElementById('pendingQrView');
  const poFormView = document.getElementById('poFormView');
  const tabAllPo = document.getElementById('tabAllPo');
  const tabPendingQr = document.getElementById('tabPendingQr');
  const poTabs = tabAllPo?.closest('.po-tabs-ribbon');
  const allPoBody = document.getElementById('allPoBody');
  const pendingQrBody = document.getElementById('pendingQrBody');
  const poCount = document.getElementById('poCount');
  const poFilterItem = document.getElementById('poFilterItem');
  const poFilterNumber = document.getElementById('poFilterNumber');
  const poFilterVendor = document.getElementById('poFilterVendor');
  const togglePoFiltersBtn = document.getElementById('togglePoFiltersBtn');
  const poFilterPanel = document.getElementById('poFilterPanel');
  const printPoListBtn = document.getElementById('printPoListBtn');
  const poPrintView = document.getElementById('poPrintView');
  const warehouseSelect = document.getElementById('poWarehouse');
  const warehouseGstinInput = document.getElementById('poWarehouseGstin');
  const warehousePanInput = document.getElementById('poWarehousePan');
  const warehouseAddressInput = document.getElementById('poWarehouseAddress');
  const warehouseBillingAddressInput = document.getElementById('poBillingAddress');
  const esc = IMS.esc;

  if (!orderId || !poNo || !orderDate || !sourceQuotation || !supplierInput || !supplierAccounts
      || !vendorAccountDetails || !vendorAccountMessage || !linesBody || !totalAmount || !poMessage
      || !allPoView || !pendingQrView || !poFormView || !tabAllPo || !tabPendingQr
      || !poTabs || !allPoBody || !pendingQrBody || !poCount || !poPrintView
      || !warehouseSelect || !warehouseGstinInput || !warehousePanInput || !warehouseAddressInput
      || !warehouseBillingAddressInput) {
    console.warn('Purchase Order: required form elements are missing.');
    return;
  }

  let vendors = [];
  let vendorLoadError = '';
  let selectedQuotation = null;
  let editingOrderId = null;
  let activeTab = 'all';
  const warehouseRecords = IMS.warehouseRecords();
  const warehouseOptions = warehouseRecords.map((warehouse) => warehouse.name);
  warehouseSelect.innerHTML = `<option value="">Select warehouse</option>${warehouseOptions.map((warehouse) =>
    `<option value="${esc(warehouse)}">${esc(warehouse)}</option>`
  ).join('')}`;
  const employeeInput = document.getElementById('poEmployee');
  const requestedByInput = document.getElementById('poRequestedBy');
  IMS.setEmployeeOptions(employeeInput);
  IMS.setEmployeeOptions(requestedByInput);
  function resolveShippingAddress(warehouse, savedAddress) {
    const legacyBillingAddress = [warehouse?.address, warehouse?.city, warehouse?.state, warehouse?.pincode]
      .filter(Boolean).join(', ');
    if (savedAddress && savedAddress === legacyBillingAddress && warehouse?.shippingAddress) {
      return warehouse.shippingAddress;
    }
    return savedAddress ?? warehouse?.shippingAddress ?? '';
  }

  function updateWarehouseDetails(savedDetails = {}) {
    const warehouse = warehouseRecords.find((entry) => entry.name === warehouseSelect.value);
    const masterAddress = [warehouse?.address, warehouse?.city, warehouse?.state, warehouse?.pincode]
      .filter(Boolean).join(', ');
    warehouseGstinInput.value = savedDetails.warehouseGstin ?? warehouse?.gstin ?? '';
    warehousePanInput.value = savedDetails.warehousePan ?? warehouse?.pan ?? '';
    warehouseAddressInput.value = resolveShippingAddress(warehouse, savedDetails.warehouseAddress);
    warehouseBillingAddressInput.value = savedDetails.billingAddress ?? masterAddress;
    if (!savedDetails.location) {
      document.getElementById('poLocation').value =
        [warehouse?.city, warehouse?.state, warehouse?.pincode].filter(Boolean).join(', ');
    }
    if (!savedDetails.placeOfSupply) {
      document.getElementById('poPlaceOfSupply').value = warehouse?.state || '';
    }
    if (!savedDetails.storeMobile) {
      document.getElementById('poStoreMobile').value = warehouse?.phone || '';
    }
  }
  const today = IMS.todayISO();
  const linkedQuotationIds = () => new Set(IMS.purchaseOrders().map((order) => String(order.quotationId || '')));
  const pendingQuotations = () => {
    const linkedIds = linkedQuotationIds();
    const linkedNumbers = new Set(IMS.purchaseOrders().map((order) => String(order.quotationNo || '').toLowerCase()));
    return IMS.qrAll().filter((quotation) =>
      !linkedIds.has(String(quotation.id))
      && !linkedNumbers.has(String(quotation.no || '').toLowerCase())
    );
  };

  function renderLists() {
    const allOrders = IMS.purchaseOrders().slice().reverse();
    const itemQuery = (poFilterItem?.value || '').trim().toLocaleLowerCase();
    const numberQuery = (poFilterNumber?.value || '').trim().toLocaleLowerCase();
    const vendorQuery = (poFilterVendor?.value || '').trim().toLocaleLowerCase();
    const orders = allOrders.filter((order) => {
      const hasItem = !itemQuery || (order.lines || []).some((line) =>
        String(line.name || line.itemName || '').toLocaleLowerCase().includes(itemQuery)
      );
      const hasNumber = !numberQuery || String(order.no || '').toLocaleLowerCase().includes(numberQuery);
      const hasVendor = !vendorQuery || String(order.supplier || '').toLocaleLowerCase().includes(vendorQuery);
      return hasItem && hasNumber && hasVendor;
    });
    allPoBody.innerHTML = orders.length ? orders.map((order, index) => `
      <tr data-open-po-row="${esc(order.id)}" title="Double-click to open this voucher">
        <td>${orders.length - index}</td>
        <td>${esc(order.no)}</td>
        <td>${esc(IMS.fmtDate(order.date))}</td>
        <td>${esc(order.supplier)}</td>
        <td>${esc(order.quotationNo)}</td>
        <td>${(Number(order.total) || 0).toFixed(2)}</td>
        <td>${esc(order.status)}</td>
        <td>${esc(order.authorizationStatus || 'Pending Authorization')}</td>
        <td>${Number((order.lines || []).length)}</td>
        <td>
          <button class="action-btn has-label" type="button" data-open-po="${esc(order.id)}">Open</button>
          <button class="action-btn has-label" type="button" data-print-po="${esc(order.id)}" aria-label="Print purchase order ${esc(order.no)}"><i class="fa-solid fa-print" aria-hidden="true"></i><span>Print</span></button>
        </td>
      </tr>`).join('') : `<tr><td colspan="10">${allOrders.length ? 'No vouchers match these filters.' : 'No purchase order vouchers yet.'}</td></tr>`;
    poCount.textContent = String(orders.length);

    const quotations = pendingQuotations().slice().reverse();
    pendingQrBody.innerHTML = quotations.length ? quotations.map((quotation, index) => `
      <tr data-open-pending-qr="${esc(quotation.id)}">
        <td>${index + 1}</td>
        <td>${esc(IMS.fmtDate(quotation.date))}</td>
        <td>${esc(quotation.no)}</td>
        <td>${esc(quotation.supplier)}</td>
        <td>${(Number(quotation.total) || 0).toFixed(2)}</td>
        <td>${Number((quotation.lines || []).length)}</td>
        <td><button class="action-btn has-label" type="button" data-create-po-from-quotation="${esc(quotation.id)}">Create PO</button></td>
      </tr>`).join('') : '<tr><td colspan="7">No pending quotations.</td></tr>';
  }

  [poFilterItem, poFilterNumber, poFilterVendor].forEach((control) => {
    control?.addEventListener('input', renderLists);
    control?.addEventListener('change', renderLists);
  });

  function setPoFiltersOpen(isOpen) {
    if (!poFilterPanel || !togglePoFiltersBtn) return;
    poFilterPanel.hidden = !isOpen;
    togglePoFiltersBtn.setAttribute('aria-expanded', String(isOpen));
    togglePoFiltersBtn.setAttribute('title', isOpen ? 'Close filters' : 'Open filters');
    togglePoFiltersBtn.setAttribute('aria-label', isOpen ? 'Close filters' : 'Open filters');
    document.querySelector('[data-shared-voucher-action="filter"]')?.setAttribute('aria-expanded', String(isOpen));
  }

  togglePoFiltersBtn?.addEventListener('click', () => {
    setPoFiltersOpen(poFilterPanel.hidden);
  });
  document.getElementById('closePoFilterBtn')?.addEventListener('click', () => setPoFiltersOpen(false));
  document.getElementById('applyPoFilterBtn')?.addEventListener('click', () => setPoFiltersOpen(false));
  document.getElementById('closePoFilterActionBtn')?.addEventListener('click', () => setPoFiltersOpen(false));
  poFilterPanel?.addEventListener('click', (event) => {
    if (event.target === poFilterPanel) setPoFiltersOpen(false);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.po-filter-panel') && !event.target.closest('#togglePoFiltersBtn')) {
      setPoFiltersOpen(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !poFilterPanel?.hidden) setPoFiltersOpen(false);
  });

  printPoListBtn?.addEventListener('click', () => {
    document.body.classList.remove('po-list-print-all', 'po-list-print-pending');
    document.body.classList.add(activeTab === 'pending' ? 'po-list-print-pending' : 'po-list-print-all');
    window.print();
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('po-list-print-all', 'po-list-print-pending');
  });

  function showTab(tab) {
    activeTab = tab;
    setPoFiltersOpen(false);
    document.body.classList.remove('po-form-active');
    poTabs.hidden = false;
    tabAllPo.classList.toggle('active', tab === 'all');
    tabPendingQr.classList.toggle('active', tab === 'pending');
    tabAllPo.setAttribute('aria-selected', String(tab === 'all'));
    tabPendingQr.setAttribute('aria-selected', String(tab === 'pending'));
    allPoView.hidden = tab !== 'all';
    pendingQrView.hidden = tab !== 'pending';
    poFormView.hidden = true;
  }

  function openForm(quotationId = '') {
    const quotation = quotationId
      ? pendingQuotations().find((entry) => String(entry.id) === String(quotationId))
      : null;
    if (quotationId && !quotation) {
      renderLists();
      return;
    }
    editingOrderId = null;
    document.getElementById('printOrderBtn').hidden = true;
    orderId.value = IMS.uid();
    orderDate.value = today;
    poNo.value = IMS.peekNo('PO', today);
    document.getElementById('poStatus').value = 'Pending';
    document.getElementById('orderNotes').value = '';
    [
      'poPaymentTerms', 'poLocation', 'poWarehouse', 'poQuotationDate', 'poBillingAddress',
      'poSupplierRefNo', 'poSupplierRefDate', 'poPlaceOfSupply', 'poReqNo', 'poStoreMobile'
    ].forEach((id) => { document.getElementById(id).value = ''; });
    IMS.setEmployeeOptions(employeeInput);
    IMS.setEmployeeOptions(requestedByInput);
    warehouseSelect.selectedIndex = 0;
    updateWarehouseDetails();
    document.getElementById('poIsIgst').value = 'No';
    document.getElementById('poRequestType').value = 'Civil Items';
    document.getElementById('poItcEligible').value = 'NA';
    sourceQuotation.value = '';
    renderQuotationLines(quotation || null);
    if (quotation) sourceQuotation.value = String(quotation.id);
    allPoView.hidden = true;
    pendingQrView.hidden = true;
    poTabs.hidden = true;
    poFormView.hidden = false;
    document.body.classList.add('po-form-active');
    message('', false);
  }

  function openSavedOrder(orderIdToEdit) {
    const order = IMS.purchaseOrders().find((entry) => String(entry.id) === String(orderIdToEdit));
    if (!order) return;

    editingOrderId = order.id;
    document.getElementById('printOrderBtn').hidden = false;
    orderId.value = order.id;
    poNo.value = order.no;
    orderDate.value = order.date || '';
    if (![...sourceQuotation.options].some((option) => option.value === String(order.quotationId))) {
      const quotation = IMS.qrAll().find((entry) => String(entry.id) === String(order.quotationId));
      const option = document.createElement('option');
      option.value = String(order.quotationId || '');
      option.textContent = `${order.quotationNo || quotation?.no || ''} — ${order.supplier}`;
      sourceQuotation.append(option);
    }
    sourceQuotation.value = String(order.quotationId || '');
    supplierInput.value = order.supplier || '';
    updateVendorDetails();
    selectedQuotation = {
      id: order.quotationId,
      no: order.quotationNo,
      supplier: order.supplier,
      taxType: IMS.qrAll().find((entry) => String(entry.id) === String(order.quotationId))?.taxType,
      lines: Array.isArray(order.lines) ? order.lines.map((orderLine) => {
        const qrLine = IMS.qrAll()
          .find((entry) => String(entry.id) === String(order.quotationId))
          ?.lines?.find((entry) => String(entry.code) === String(orderLine.code));
        if (!qrLine || ['cgst', 'sgst', 'igst'].some((key) => Object.prototype.hasOwnProperty.call(orderLine, key))) {
          return orderLine;
        }
        return {
          ...orderLine,
          cgst: qrLine.cgst,
          sgst: qrLine.sgst,
          igst: qrLine.igst,
          gstRate: qrLine.gstRate,
          taxableAmount: qrLine.taxableAmount,
          gstBaseQty: qrLine.qty
        };
      }) : []
    };
    renderQuotationLines(selectedQuotation);

    const details = order.printDetails || {};
    document.getElementById('poStatus').value = order.status || 'Pending';
    document.getElementById('orderNotes').value = order.notes || '';
    document.getElementById('poPaymentTerms').value = details.paymentTerms || '';
    document.getElementById('poLocation').value = details.location || '';
    warehouseBillingAddressInput.value = details.billingAddress || '';
    if (details.warehouse && ![...warehouseSelect.options].some((option) => option.value === details.warehouse)) {
      warehouseSelect.add(new Option(details.warehouse, details.warehouse));
    }
    warehouseSelect.value = details.warehouse || '';
    updateWarehouseDetails(details);
    IMS.setEmployeeOptions(employeeInput, details.employee || '');
    IMS.setEmployeeOptions(requestedByInput, details.requestedBy || '');
    document.getElementById('poQuotationDate').value = details.quotationDate || '';
    document.getElementById('poSupplierRefNo').value = details.supplierRefNo || '';
    document.getElementById('poSupplierRefDate').value = details.supplierRefDate || '';
    document.getElementById('poPlaceOfSupply').value = details.placeOfSupply || '';
    document.getElementById('poIsIgst').value = details.isIgst || 'No';
    document.getElementById('poReqNo').value = details.reqNo || '';
    document.getElementById('poRequestType').value = details.requestType || 'Civil Items';
    document.getElementById('poStoreMobile').value = details.storeMobile || '';
    document.getElementById('poItcEligible').value = details.itcEligible || 'NA';
    selectedQuotation.lines.forEach((line, index) => {
      const discount = linesBody.querySelector(`[data-po-discount="${index}"]`);
      const freight = linesBody.querySelector(`[data-po-freight="${index}"]`);
      if (discount) discount.value = Number(line.discount) || 0;
      if (freight) freight.value = Number(line.freightCharges) || 0;
    });
    updateTotal();
    allPoView.hidden = true;
    pendingQrView.hidden = true;
    poTabs.hidden = true;
    poFormView.hidden = false;
    document.body.classList.add('po-form-active');
    message('', false);
  }

  sourceQuotation.innerHTML = '<option value="">Select quotation</option>' + pendingQuotations().map((quotation) =>
    `<option value="${esc(quotation.id)}">${esc(quotation.no)} — ${esc(quotation.supplier)}</option>`
  ).join('');

  try {
    const savedAccounts = localStorage.getItem('softManagerAccounts');
    const parsedAccounts = savedAccounts ? JSON.parse(savedAccounts) : [];
    if (!Array.isArray(parsedAccounts)) throw new Error('Saved account data must be a list.');
    vendors = parsedAccounts.filter((account) =>
      account && typeof account === 'object' && (!account.type || account.type === 'Vendor')
      && typeof account.name === 'string' && account.name.trim()
    );
    vendors.forEach((vendor) => {
      const option = document.createElement('option');
      option.value = vendor.name;
      option.label = vendor.code || vendor.name;
      supplierAccounts.append(option);
    });
    if (vendors.length === 0) {
      vendorAccountMessage.textContent = 'No vendor accounts saved yet. Add vendor details in Account Master.';
      vendorAccountMessage.hidden = false;
    }
  } catch (error) {
    vendorLoadError = `Could not load vendor accounts: ${error.message}`;
    vendorAccountMessage.textContent = vendorLoadError;
    vendorAccountMessage.hidden = false;
    vendorAccountMessage.classList.add('error');
  }

  function message(text, error = false) {
    poMessage.textContent = text;
    poMessage.classList.toggle('error', error);
  }

  function setVendorAccountMessage(text, error = false) {
    vendorAccountMessage.textContent = text;
    vendorAccountMessage.hidden = !text;
    vendorAccountMessage.classList.toggle('error', error);
  }

  function updateVendorDetails(showValidationMessage = false) {
    const selectedName = supplierInput.value.trim().toLowerCase();
    const vendor = vendors.find((entry) => entry.name.trim().toLowerCase() === selectedName);
    vendorAccountDetails.replaceChildren();
    vendorAccountDetails.hidden = !vendor;
    if (!vendor) {
      supplierInput.setAttribute('aria-invalid', String(Boolean(selectedName && showValidationMessage)));
      if (vendorLoadError) {
        setVendorAccountMessage(vendorLoadError, true);
      } else if (selectedName && showValidationMessage) {
        setVendorAccountMessage('Not permitted. Select a supplier added as Vendor in Account Master.', true);
      } else if (vendors.length > 0 || selectedName) {
        setVendorAccountMessage('', false);
      }
      return;
    }
    supplierInput.removeAttribute('aria-invalid');
    setVendorAccountMessage('', false);
    document.getElementById('poPaymentTerms').value = vendor.paymentTerms || '';
    document.getElementById('poPlaceOfSupply').value = vendor.state || '';
    document.getElementById('poStoreMobile').value = vendor.phone || '';

    const heading = document.createElement('strong');
    heading.textContent = `${vendor.name}${vendor.code ? ` (${vendor.code})` : ''}`;
    vendorAccountDetails.append(heading);
    [
      vendor.contact && `Contact: ${vendor.contact}`,
      vendor.phone && `Phone: ${vendor.phone}`,
      vendor.email && `Email: ${vendor.email}`,
      vendor.gstin && `GSTIN: ${vendor.gstin}`,
      vendor.address && `Billing address: ${vendor.address}`,
      [vendor.city, vendor.state, vendor.pincode].filter(Boolean).length
        ? `Location: ${[vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ')}`
        : '',
      vendor.paymentTerms && `Payment terms: ${vendor.paymentTerms}`
    ].filter(Boolean).forEach((detail) => {
      const line = document.createElement('span');
      line.textContent = detail;
      vendorAccountDetails.append(line);
    });
  }

  function renderQuotationLines(quotation) {
    selectedQuotation = quotation;
    sourceQuotation.value = quotation ? String(quotation.id) : '';
    const receivedQuotation = quotation
      ? IMS.qrAll().find((entry) => String(entry.id) === String(quotation.id))
      : null;
    document.getElementById('poQuotationDate').value = receivedQuotation?.date || '';
    const quotationLines = quotation?.lines || [];
    const itemRows = quotationLines.map((line, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(line.category)}</td>
        <td>${esc(line.brand)}</td>
        <td>${esc(line.name)} (${esc(line.code)})</td>
        <td>${esc(line.description)}</td>
        <td>${esc(line.unit)}</td>
        <td><input class="ims-lines-input" type="text" inputmode="decimal" value="${Number(line.qty) || 0}" data-po-qty="${index}" aria-label="Purchase order quantity for ${esc(line.name)}"></td>
        <td>${esc(quotation?.no)}</td>
        <td data-po-rate="${index}">${(Number(line.rate) || 0).toFixed(2)}</td>
        <td data-po-gross="${index}">0.00</td>
        <td><input class="ims-lines-input" type="text" inputmode="decimal" value="0" data-po-discount="${index}" aria-label="Discount for ${esc(line.name)}"></td>
        <td><input class="ims-lines-input" type="text" inputmode="decimal" value="0" data-po-freight="${index}" aria-label="Freight charges for ${esc(line.name)}"></td>
        <td><input class="ims-lines-input" type="text" inputmode="decimal" value="${Number(line.gstRate ?? IMS.items().find((item) => String(item.code) === String(line.code))?.gst) || 0}" data-po-gst-rate="${index}" aria-label="GST percentage for ${esc(line.name)}"></td>
        <td><input class="ims-lines-input" type="number" min="0" step="0.01" value="0" data-po-cgst="${index}" aria-label="CGST for ${esc(line.name)}" readonly></td>
        <td><input class="ims-lines-input" type="number" min="0" step="0.01" value="0" data-po-sgst="${index}" aria-label="SGST for ${esc(line.name)}" readonly></td>
        <td><input class="ims-lines-input" type="number" min="0" step="0.01" value="0" data-po-igst="${index}" aria-label="IGST for ${esc(line.name)}" readonly></td>
        <td data-po-amount="${index}">0.00</td>
      </tr>`).join('');
    const emptyRows = Array.from({ length: Math.max(0, 5 - quotationLines.length) }, (_, offset) => `
      <tr class="po-empty-line">
        <td>${quotationLines.length + offset + 1}</td>
        ${Array.from({ length: 16 }, () => '<td></td>').join('')}
      </tr>`).join('');
    linesBody.innerHTML = itemRows + emptyRows;
    quotationLines.forEach((line, index) => updateLineGst(index));
    supplierInput.value = quotation?.supplier || '';
    updateVendorDetails(true);
    updateTotal();
  }

  function quotationTaxAmounts(line, taxType) {
    const item = IMS.items().find((entry) => String(entry.code) === String(line.code));
    const gstRate = Number(line.gstRate ?? item?.gst) || 0;
    const taxableAmount = Number(line.taxableAmount)
      || (Number(line.qty) || 0) * (Number(line.rate) || 0);
    const tax = taxableAmount * gstRate / 100;
    return taxType === 'inter'
      ? { cgst: 0, sgst: 0, igst: tax }
      : { cgst: tax / 2, sgst: tax / 2, igst: 0 };
  }

  function updateLineGst(index) {
    const line = selectedQuotation?.lines?.[index];
    if (!line) return;
    const qty = Number(linesBody.querySelector(`[data-po-qty="${index}"]`)?.value) || 0;
    const taxableValue = Math.max(0, qty * (Number(line.rate) || 0));
    const gstRate = Math.max(0, Number(linesBody.querySelector(`[data-po-gst-rate="${index}"]`)?.value) || 0);
    const taxAmount = taxableValue * gstRate / 100;
    const tax = selectedQuotation.taxType === 'inter'
      ? { cgst: 0, sgst: 0, igst: taxAmount }
      : { cgst: taxAmount / 2, sgst: taxAmount / 2, igst: 0 };
    ['cgst', 'sgst', 'igst'].forEach((taxName) => {
      const input = linesBody.querySelector(`[data-po-${taxName}="${index}"]`);
      if (input) input.value = tax[taxName].toFixed(2);
    });
  }

  function updateTotal() {
    let total = 0;
    linesBody.querySelectorAll('[data-po-qty]').forEach((input) => {
      const index = Number(input.dataset.poQty);
      const rate = Number(selectedQuotation?.lines?.[index]?.rate) || 0;
      const gross = Math.max(0, Number(input.value) || 0) * rate;
      const discount = Number(linesBody.querySelector(`[data-po-discount="${index}"]`).value) || 0;
      const freight = Number(linesBody.querySelector(`[data-po-freight="${index}"]`).value) || 0;
      const taxableValue = gross - discount + freight;
      const gstRate = Math.max(0, Number(linesBody.querySelector(`[data-po-gst-rate="${index}"]`)?.value) || 0);
      const taxAmount = taxableValue * gstRate / 100;
      const tax = selectedQuotation?.taxType === 'inter'
        ? { cgst: 0, sgst: 0, igst: taxAmount }
        : { cgst: taxAmount / 2, sgst: taxAmount / 2, igst: 0 };
      ['cgst', 'sgst', 'igst'].forEach((taxName) => {
        const taxInput = linesBody.querySelector(`[data-po-${taxName}="${index}"]`);
        if (taxInput) taxInput.value = tax[taxName].toFixed(2);
      });
      const cgst = Number(linesBody.querySelector(`[data-po-cgst="${index}"]`)?.value) || 0;
      const sgst = Number(linesBody.querySelector(`[data-po-sgst="${index}"]`)?.value) || 0;
      const igst = Number(linesBody.querySelector(`[data-po-igst="${index}"]`)?.value) || 0;
      linesBody.querySelector(`[data-po-gross="${index}"]`).textContent = gross.toFixed(2);
      linesBody.querySelector(`[data-po-amount="${index}"]`).textContent = taxableValue.toFixed(2);
      total += taxableValue + cgst + sgst + igst;
    });
    totalAmount.value = total.toFixed(2);
    document.getElementById('poNetDisplay').textContent = total.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatPrintDate(value) {
    return value ? IMS.fmtDate(value) : '';
  }

  function printOrder(orderIdToPrint) {
    const order = IMS.purchaseOrders().find((entry) => String(entry.id) === String(orderIdToPrint));
    if (!order) return;
    const details = order.printDetails || {};
    const quotation = IMS.qrAll().find((entry) => String(entry.id) === String(order.quotationId));
    const vendor = vendors.find((entry) => entry.name.trim().toLowerCase() === String(order.supplier || '').trim().toLowerCase());
    const warehouse = warehouseRecords.find((entry) => entry.name === details.warehouse);
    const lines = Array.isArray(order.lines) ? order.lines : [];
    const money = (value) => (Number(value) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const quantity = (value) => (Number(value) || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 3
    });
    const amountInWords = (amount) => {
      const ones = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
        'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
      const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
      const underThousand = (number) => {
        if (number < 20) return ones[number];
        if (number < 100) return `${tens[Math.floor(number / 10)]}${number % 10 ? ` ${ones[number % 10]}` : ''}`;
        return `${ones[Math.floor(number / 100)]} HUNDRED${number % 100 ? ` ${underThousand(number % 100)}` : ''}`;
      };
      const integerWords = (number) => {
        if (!number) return 'ZERO';
        const groups = [
          [10000000, 'CRORE'], [100000, 'LAKH'], [1000, 'THOUSAND'], [1, '']
        ];
        let remainder = number;
        const parts = [];
        groups.forEach(([value, label]) => {
          const count = Math.floor(remainder / value);
          if (count) {
            parts.push(`${underThousand(count)}${label ? ` ${label}` : ''}`);
            remainder %= value;
          }
        });
        return parts.join(' ');
      };
      const rounded = Math.round((Number(amount) || 0) * 100);
      const rupees = Math.floor(rounded / 100);
      const paise = rounded % 100;
      return `${integerWords(rupees)}${paise ? ` AND ${integerWords(paise)} PAISE` : ''} ONLY`;
    };
    const vendorAddress = vendor?.address || '';
    const warehouseAddress = resolveShippingAddress(warehouse, details.warehouseAddress);
    const billingAddress = details.billingAddress
      || [warehouse?.address, warehouse?.city, warehouse?.state, warehouse?.pincode].filter(Boolean).join(', ');
    const warehouseState = warehouse?.state || details.placeOfSupply;
    const totals = lines.reduce((sum, line) => {
      const gross = (Number(line.qty) || 0) * (Number(line.rate) || 0);
      const taxable = gross - (Number(line.discount) || 0) + (Number(line.freightCharges) || 0);
      const cgst = Number(line.cgst) || 0;
      const sgst = Number(line.sgst) || 0;
      const igst = Number(line.igst) || 0;
      sum.gross += gross;
      sum.discount += Number(line.discount) || 0;
      sum.freight += Number(line.freightCharges) || 0;
      sum.taxable += taxable;
      sum.cgst += cgst;
      sum.sgst += sgst;
      sum.igst += igst;
      sum.tax += cgst + sgst + igst;
      sum.total += taxable + cgst + sgst + igst;
      return sum;
    }, { gross: 0, discount: 0, freight: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, total: 0 });
    const roundedTotal = Math.round(totals.total);
    const rows = lines.map((line, index) => {
      const qty = Number(line.qty) || 0;
      const rate = Number(line.rate) || 0;
      const gross = qty * rate;
      const discount = Number(line.discount) || 0;
      const freight = Number(line.freightCharges) || 0;
      const taxable = gross - discount + freight;
      return `<tr>
        <td>${index + 1}</td>
        <td>${esc(line.code)}</td>
        <td>${esc([line.name, line.description].filter(Boolean).join(' — '))}</td>
        <td class="numeric">${quantity(qty)}</td>
        <td>${esc(line.unit)}</td>
        <td class="numeric">${money(rate)}</td>
        <td class="numeric">${money(gross)}</td>
        <td class="numeric">${money(discount)}</td>
        <td class="numeric">${money(taxable)}</td>
        <td class="numeric">${money(line.cgst)}</td>
        <td class="numeric">${money(line.sgst)}</td>
        <td class="numeric">${money(line.igst)}</td>
        <td class="numeric">${money(taxable + (Number(line.cgst) || 0) + (Number(line.sgst) || 0) + (Number(line.igst) || 0))}</td>
      </tr>`;
    }).join('');

    const poFields = [
      ['Purchase Order No.', order.no],
      ['PO Date', formatPrintDate(order.date)],
      ['Vendor Code', vendor?.code],
      ['Quotation Ref No.', order.quotationNo],
      ['Quotation Ref Date', formatPrintDate(details.quotationDate || quotation?.date)],
      ['Payment Terms', details.paymentTerms || vendor?.paymentTerms]
    ];
    const supplierFields = [
      ['Name', order.supplier],
      ['Address', vendorAddress],
      ['City', vendor?.city],
      ['State', vendor?.state],
      ['GSTIN', vendor?.gstin],
      ['PIN', vendor?.pincode],
      ['Mobile', vendor?.phone]
    ];
    const renderPrintFields = (fields) => fields.map(([label, value]) => `
      <div class="po-print-field"><strong>${esc(label)}</strong><span>:</span><span>${esc(value || '-')}</span></div>
    `).join('');
    const companyAddress = 'C - 619, 6th Floor, Spectrum Metro Mall Tower-C, Sector-75, Noida, Uttar Pradesh, 201301';
    const totalQty = lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0);

    poPrintView.innerHTML = `
      <article class="po-print-document">
      <header class="po-print-masthead">
        <div class="po-print-brand">SPECTRUM<span>@METRO</span></div>
        <div class="po-print-company">
          <strong>Umbrella Facility Management Services Pvt Ltd</strong>
          <span>${companyAddress}</span>
          <span>GSTIN: 09AACCU6261C1ZF&nbsp;&nbsp; | &nbsp;&nbsp;PAN: AACCU6261C</span>
        </div>
      </header>
      <header class="po-print-titlebar">
        <h1>Purchase Order</h1>
        <strong>PO NO. : <span>${esc(order.no || '-')}</span></strong>
      </header>
      <section class="po-print-cards po-print-detail-cards">
        <div class="po-print-card po-print-supplier">
          <h2>Supplier Details</h2>
          <div class="po-print-card-body">${renderPrintFields(supplierFields)}</div>
        </div>
        <div class="po-print-card po-print-order">
          <h2>PO Details</h2>
          <div class="po-print-card-body">${renderPrintFields(poFields)}</div>
        </div>
      </section>
      <section class="po-print-cards po-print-address-cards">
        <div class="po-print-card">
          <h2>Shipping / Billing Address</h2>
          <div class="po-print-address-body">
            <strong>Address:</strong><span>${esc(warehouseAddress || billingAddress || companyAddress)}</span>
            <strong>Billing:</strong><span>${esc(billingAddress || companyAddress)}</span>
            ${warehouseState ? `<strong>State:</strong><span>${esc(warehouseState)}</span>` : ''}
          </div>
        </div>
        <div class="po-print-card">
          <h2>Contact Details</h2>
          <div class="po-print-card-body">
            <div class="po-print-field"><strong>Purchase Mobile No.</strong><span>:</span><span>${esc(details.purchaseMobile || '-')}</span></div>
            <div class="po-print-field"><strong>Store Mobile No.</strong><span>:</span><span>${esc(details.storeMobile || warehouse?.phone || '-')}</span></div>
          </div>
        </div>
      </section>
      <table class="po-print-table">
        <colgroup>
          <col class="po-col-sno"><col class="po-col-code"><col class="po-col-description"><col class="po-col-qty">
          <col class="po-col-uom"><col class="po-col-rate"><col class="po-col-gross"><col class="po-col-discount">
          <col class="po-col-taxable"><col class="po-col-gst"><col class="po-col-gst"><col class="po-col-gst"><col class="po-col-net">
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2">#</th><th rowspan="2">Item Code</th><th rowspan="2">Description of Goods</th>
            <th rowspan="2">Qty</th><th rowspan="2">UOM</th><th rowspan="2">Rate (&#8377;)</th>
            <th rowspan="2">Gross Amount (&#8377;)</th><th rowspan="2">Disc. (&#8377;)</th>
            <th rowspan="2">Taxable Amount (&#8377;)</th><th colspan="3">GST (&#8377;)</th><th rowspan="2">Net Amount (&#8377;)</th>
          </tr>
          <tr><th>CGST</th><th>SGST</th><th>IGST</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="13">No items</td></tr>'}</tbody>
        <tfoot><tr>
          <th colspan="3">Total</th><th class="numeric">${quantity(totalQty)}</th><th></th>
          <th></th><th class="numeric">${money(totals.gross)}</th><th class="numeric">${money(totals.discount)}</th>
          <th class="numeric">${money(totals.taxable)}</th>
          <th class="numeric">${money(totals.cgst)}</th><th class="numeric">${money(totals.sgst)}</th>
          <th class="numeric">${money(totals.igst)}</th><th class="numeric">${money(roundedTotal)}</th>
        </tr></tfoot>
      </table>
      <section class="po-print-bottom">
        <div class="po-print-left-summary">
          <div class="po-print-narration"><h2>Narration / Remarks</h2><p>${esc(order.notes || '-')}</p></div>
          <div class="po-print-words"><strong>Amount in Words :</strong> ${esc(amountInWords(roundedTotal))}</div>
        </div>
        <div class="po-print-totals">
          <h2>Amount Summary</h2>
          <div><strong>Taxable Value</strong><span>&#8377; ${money(totals.gross - totals.discount)}</span></div>
          <div><strong>Freight</strong><span>${money(totals.freight)}</span></div>
          <div><strong>Total Taxable Value</strong><span>&#8377; ${money(totals.taxable)}</span></div>
          <div><strong>CGST</strong><span>${money(totals.cgst)}</span></div>
          <div><strong>SGST</strong><span>${money(totals.sgst)}</span></div>
          <div><strong>IGST</strong><span>${money(totals.igst)}</span></div>
          <div class="po-print-total"><strong>Total Value (Rounded)</strong><span>&#8377; ${money(roundedTotal)}</span></div>
        </div>
      </section>
      <section class="po-print-terms">
        <div><h2>Terms &amp; Conditions</h2><ol>
          <li>Material should be supplied as per the approved specification and quality.</li>
          <li>Delivery should be made within the agreed period.</li>
          <li>Invoice must mention PO number and GST details.</li>
          <li>Payments will be released as per agreed terms.</li>
        </ol></div>
        <div class="po-print-signature">
          <strong>For Umbrella Facility Management Services Pvt Ltd</strong>
          <span></span>
          <b>Authorised Signatory</b>
        </div>
      </section>
      <footer class="po-print-signatures">
        This is a computer-generated purchase order.
      </footer>
      </article>
    `;
    document.body.classList.add('po-printing');
    window.print();
  }

  sourceQuotation.addEventListener('change', () => {
    const quotation = IMS.qrAll().find((entry) => String(entry.id) === sourceQuotation.value);
    renderQuotationLines(quotation || null);
    message('', false);
  });
  warehouseSelect.addEventListener('change', () => updateWarehouseDetails());
  tabAllPo.addEventListener('click', () => showTab('all'));
  tabPendingQr.addEventListener('click', () => showTab('pending'));
  document.getElementById('newOrderBtn')?.addEventListener('click', () => openForm());
  document.getElementById('saveOrderTopBtn')?.addEventListener('click', () => {
    document.getElementById('saveOrderBtn').click();
  });
  document.getElementById('openQuotationReceiveBtn')?.addEventListener('click', () => {
    window.location.href = 'quotation-receive.html';
  });
  pendingQrBody.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    const row = event.target.closest('[data-open-pending-qr]');
    if (row) openForm(row.dataset.openPendingQr);
  });
  pendingQrBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-create-po-from-quotation]');
    if (button) openForm(button.dataset.createPoFromQuotation);
  });
  allPoBody.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-open-po]');
    if (openButton) {
      openSavedOrder(openButton.dataset.openPo);
      return;
    }
    const button = event.target.closest('[data-print-po]');
    if (button) printOrder(button.dataset.printPo);
  });
  document.getElementById('printOrderBtn')?.addEventListener('click', () => {
    if (editingOrderId) printOrder(editingOrderId);
  });
  allPoBody.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    const row = event.target.closest('[data-open-po-row]');
    if (row) openSavedOrder(row.dataset.openPoRow);
  });
  document.getElementById('cancelOrderBtn')?.addEventListener('click', () => {
    selectedQuotation = null;
    editingOrderId = null;
    document.body.classList.remove('po-form-active');
    message('', false);
    renderLists();
    showTab(activeTab);
  });
  linesBody.addEventListener('input', (event) => {
    const qtyInput = event.target.closest('[data-po-qty]');
    if (qtyInput) updateLineGst(Number(qtyInput.dataset.poQty));
    updateTotal();
  });
  linesBody.addEventListener('focusin', (event) => {
    const input = event.target.closest('input[inputmode="decimal"]:not([readonly])');
    if (input) input.select();
  });
  linesBody.addEventListener('click', (event) => {
    const input = event.target.closest('input[inputmode="decimal"]:not([readonly])');
    if (input) input.select();
  });
  supplierInput.addEventListener('input', () => updateVendorDetails());
  supplierInput.addEventListener('change', () => updateVendorDetails(true));
  orderDate.addEventListener('change', () => {
    if (!editingOrderId) poNo.value = IMS.peekNo('PO', orderDate.value);
  });

  document.getElementById('saveOrderBtn')?.addEventListener('click', () => {
    if (!selectedQuotation) return message('Select a quotation before saving the purchase order.', true);
    if (!editingOrderId && pendingQuotations().every((quotation) => String(quotation.id) !== String(selectedQuotation.id))) {
      return message('This quotation already has a purchase order. Select another pending quotation.', true);
    }
    if (!orderDate.value) return message('Please select a purchase order date.', true);
    if (!supplierInput.value.trim()) return message('Supplier is required.', true);
    if (vendorLoadError) return message(`${vendorLoadError}. Purchase order was not saved.`, true);
    const selectedVendor = vendors.find((entry) =>
      entry.name.trim().toLowerCase() === supplierInput.value.trim().toLowerCase()
    );
    if (!selectedVendor) {
      updateVendorDetails(true);
      return message('Not permitted. Select a supplier added as Vendor in Account Master.', true);
    }
    if (!String(selectedVendor.gstin || '').trim()) {
      return message('Supplier GSTIN is missing. Add GSTIN in Account Master before saving this purchase order.', true);
    }
    if (!warehouseGstinInput.value.trim()) {
      return message('Warehouse GSTIN is required. Add it in Warehouse Master before saving this purchase order.', true);
    }
    const existingOrder = editingOrderId
      ? IMS.purchaseOrders().find((entry) => String(entry.id) === String(editingOrderId))
      : null;
    if (editingOrderId && !existingOrder) {
      return message('This purchase order no longer exists. Refresh the voucher list and try again.', true);
    }
    const lines = [];
    for (let index = 0; index < selectedQuotation.lines.length; index += 1) {
      const sourceLine = selectedQuotation.lines[index];
      const input = linesBody.querySelector(`[data-po-qty="${index}"]`);
      const qty = Number(input?.value);
      if (!Number.isFinite(qty) || qty <= 0 || qty > Number(sourceLine.qty)) {
        return message(`Quantity for ${sourceLine.name} must be greater than zero and no more than the quotation quantity.`, true);
      }
      const previousLine = existingOrder?.lines?.find((line) => String(line.code) === String(sourceLine.code));
      const receivedQty = Number(previousLine?.receivedQty) || 0;
      if (qty < receivedQty) {
        return message(`Quantity for ${sourceLine.name} cannot be less than the ${receivedQty} already received.`, true);
      }
      const gross = qty * (Number(sourceLine.rate) || 0);
      const discount = Number(linesBody.querySelector(`[data-po-discount="${index}"]`).value);
      const freightCharges = Number(linesBody.querySelector(`[data-po-freight="${index}"]`).value);
      const gstRate = Number(linesBody.querySelector(`[data-po-gst-rate="${index}"]`)?.value);
      const cgst = Number(linesBody.querySelector(`[data-po-cgst="${index}"]`)?.value);
      const sgst = Number(linesBody.querySelector(`[data-po-sgst="${index}"]`)?.value);
      const igst = Number(linesBody.querySelector(`[data-po-igst="${index}"]`)?.value);
      if (!Number.isFinite(discount) || discount < 0 || discount > gross) {
        return message(`Discount for ${sourceLine.name} must be between zero and its gross amount.`, true);
      }
      if (!Number.isFinite(freightCharges) || freightCharges < 0) {
        return message(`Freight charges for ${sourceLine.name} must be zero or greater.`, true);
      }
      if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
        return message(`GST percentage for ${sourceLine.name} must be between 0 and 100.`, true);
      }
      if (![cgst, sgst, igst].every((amount) => Number.isFinite(amount) && amount >= 0)) {
        return message(`GST amounts for ${sourceLine.name} must be zero or greater.`, true);
      }
      const gstAmount = cgst + sgst + igst;
      if (gstAmount <= 0) {
        return message(`Enter GST for ${sourceLine.name} in the CGST, SGST, or IGST field.`, true);
      }
      lines.push({
        ...sourceLine,
        qty,
        discount,
        freightCharges,
        gstRate,
        taxableAmount: gross - discount + freightCharges,
        cgst,
        sgst,
        igst,
        amount: gross - discount + freightCharges + gstAmount,
        receivedQty,
        consumed: Number(previousLine?.consumed) || 0
      });
    }
    if (!lines.length) return message('The selected quotation has no items.', true);

    try {
      const date = orderDate.value;
      const order = {
        id: existingOrder?.id || orderId.value || IMS.uid(),
        no: existingOrder?.no || IMS.nextNo('PO', date),
        date,
        quotationId: selectedQuotation.id,
        quotationNo: selectedQuotation.no,
        supplier: supplierInput.value.trim(),
        total: lines.reduce((sum, line) => sum + line.amount, 0),
        status: document.getElementById('poStatus').value,
        authorizationStatus: 'Pending Authorization',
        notes: document.getElementById('orderNotes').value.trim(),
        printDetails: {
          paymentTerms: document.getElementById('poPaymentTerms').value.trim(),
          location: document.getElementById('poLocation').value.trim(),
          warehouse: document.getElementById('poWarehouse').value.trim(),
          warehouseAddress: warehouseAddressInput.value.trim(),
          billingAddress: warehouseBillingAddressInput.value.trim(),
          warehouseGstin: warehouseGstinInput.value.trim(),
          warehousePan: warehousePanInput.value.trim(),
          employee: employeeInput.value,
          requestedBy: requestedByInput.value,
          quotationDate: document.getElementById('poQuotationDate').value,
          supplierRefNo: document.getElementById('poSupplierRefNo').value.trim(),
          supplierRefDate: document.getElementById('poSupplierRefDate').value,
          placeOfSupply: document.getElementById('poPlaceOfSupply').value.trim(),
          isIgst: document.getElementById('poIsIgst').value,
          reqNo: document.getElementById('poReqNo').value.trim(),
          requestType: document.getElementById('poRequestType').value,
          storeMobile: document.getElementById('poStoreMobile').value.trim(),
          itcEligible: document.getElementById('poItcEligible').value
        },
        lines
      };
      const orders = IMS.purchaseOrders();
      const nextOrders = existingOrder
        ? orders.map((entry) => String(entry.id) === String(existingOrder.id) ? order : entry)
        : [...orders, order];
      IMS.purchaseOrdersSave(nextOrders);
      poNo.value = order.no;
      selectedQuotation = null;
      editingOrderId = null;
      renderLists();
      showTab('all');
    } catch (error) {
      message(`Could not save purchase order: ${error.message}`, true);
    }
  });

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('po-printing');
  });

  renderLists();
  const requestedParams = new URLSearchParams(window.location.search);
  const requestedView = requestedParams.get('view');
  const requestedOrderId = requestedParams.get('orderId');
  if (requestedOrderId) {
    openSavedOrder(requestedOrderId);
  } else if (requestedView === 'pending') {
    showTab('pending');
  } else if (requestedView === 'all') {
    showTab('all');
  } else if (requestedView === 'new') {
    openForm();
  } else {
    showTab('all');
  }
});
