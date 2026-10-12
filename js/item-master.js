document.addEventListener('DOMContentLoaded', function () {
  const storageKey = 'softManagerItems';
  const accountStorageKey = 'softManagerAccounts';
  const form = document.getElementById('itemForm');
  const tableBody = document.getElementById('itemTableBody');
  const itemsView = document.getElementById('itemsView');
  const formPanel = document.getElementById('itemFormPanel');
  const itemSearch = document.getElementById('itemSearch');
  const statusMessage = document.getElementById('statusMessage');
  const addMasterRecordButton = document.getElementById('addMasterRecordBtn');
  const gstSelect = document.getElementById('itemGst');
  const priceInput = document.getElementById('itemPrice');
  const itemNameInput = document.getElementById('itemName');
  const itemBrandInput = document.getElementById('itemBrand');
  const itemBrandHint = document.getElementById('itemBrandHint');
  const accountForm = document.getElementById('accountForm');
  const accountTableBody = document.getElementById('accountTableBody');
  const accountSearch = document.getElementById('accountSearch');
  const accountMasterPanel = document.getElementById('accountMasterPanel');
  const departmentMasterPanel = document.getElementById('departmentMasterPanel');
  const departmentForm = document.getElementById('departmentForm');
  const departmentTableBody = document.getElementById('departmentTableBody');
  const newDepartmentInput = document.getElementById('newDepartment');
  const warehouseMasterPanel = document.getElementById('warehouseMasterPanel');
  const warehouseForm = document.getElementById('warehouseForm');
  const warehouseTableBody = document.getElementById('warehouseTableBody');
  const newWarehouseInput = document.getElementById('newWarehouse');
  const cancelWarehouseFormButton = document.getElementById('cancelWarehouseFormBtn');
  const employeeMasterPanel = document.getElementById('employeeMasterPanel');
  const employeeForm = document.getElementById('employeeForm');
  const employeeTableBody = document.getElementById('employeeTableBody');
  const employeeNameInput = document.getElementById('employeeName');
  const accountsView = document.getElementById('accountsView');
  const accountFormPanel = document.getElementById('accountFormPanel');
  const itemLayout = document.getElementById('itemLayout');
  const itemCategories = [
    'Building Material',
    'Electrical',
    'Electronics',
    'Fire And Safety',
    'Hardware',
    'Housekeeping',
    'Stationery'
  ];

  let items = [];
  let accounts = [];
  let departments = [];
  let warehouses = [];
  let employees = [];
  let editingWarehouseName = null;
  let editingEmployeeName = null;
  let editingId = null;
  let editingAccountId = null;
  let activeCategory = 'all';
  let activeMaster = 'item';
  let itemsStorageReady = true;
  let accountsStorageReady = true;
  let departmentsStorageReady = true;
  let warehousesStorageReady = true;
  let employeesStorageReady = true;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  function showMessage(message, isError) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle('error', Boolean(isError));
    statusMessage.classList.toggle('visible', Boolean(message));
  }

  function loadItems() {
    const storedItems = localStorage.getItem(storageKey);
    if (!storedItems) return [];

    const parsedItems = JSON.parse(storedItems);
    if (!Array.isArray(parsedItems) || parsedItems.some((item) =>
      !item || typeof item !== 'object' || !Number.isFinite(Number(item.id))
    )) {
      throw new Error('Saved item data is not in the expected format.');
    }
    return parsedItems;
  }

  function persistItems(nextItems) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextItems));
      items = nextItems;
      return true;
    } catch (error) {
      showMessage(`Could not save item data: ${error.message}`, true);
      return false;
    }
  }

  function loadAccounts() {
    const storedAccounts = localStorage.getItem(accountStorageKey);
    if (!storedAccounts) return [];

    const parsedAccounts = JSON.parse(storedAccounts);
    if (!Array.isArray(parsedAccounts) || parsedAccounts.some((account) =>
      !account || typeof account !== 'object' || !Number.isFinite(Number(account.id))
    )) {
      throw new Error('Saved account data is not in the expected format.');
    }
    return parsedAccounts;
  }

  function persistAccounts(nextAccounts) {
    try {
      localStorage.setItem(accountStorageKey, JSON.stringify(nextAccounts));
      accounts = nextAccounts;
      return true;
    } catch (error) {
      showMessage(`Could not save account data: ${error.message}`, true);
      return false;
    }
  }

  function switchMaster(master) {
    activeMaster = master;
    closeForm();
    closeAccountForm();
    closeEmployeeForm();
    const masterTabs = {
      item: { tab: document.getElementById('itemsMasterTab'), panel: itemLayout, title: 'Item Master', description: 'Manage item details, stock, and GST rates.', addLabel: 'item', ready: itemsStorageReady },
      account: { tab: document.getElementById('accountsMasterTab'), panel: accountMasterPanel, title: 'Account Master', description: 'Manage vendors and account details used for purchase orders.', addLabel: 'account', ready: accountsStorageReady },
      department: { tab: document.getElementById('departmentsMasterTab'), panel: departmentMasterPanel, title: 'Department Master', description: 'Manage departments available in Material Issue.', addLabel: 'department', ready: departmentsStorageReady },
      warehouse: { tab: document.getElementById('warehousesMasterTab'), panel: warehouseMasterPanel, title: 'Warehouse Master', description: 'Manage warehouses available in Material Issue and Purchase Order.', addLabel: 'warehouse', ready: warehousesStorageReady },
      employee: { tab: document.getElementById('employeesMasterTab'), panel: employeeMasterPanel, title: 'Employee Master', description: 'Manage names available in Employee and Requested By fields.', addLabel: 'employee', ready: employeesStorageReady }
    };
    const selected = masterTabs[master] || masterTabs.item;
    Object.entries(masterTabs).forEach(([key, entry]) => {
      const active = key === master;
      entry.tab.classList.toggle('active', active);
      entry.tab.setAttribute('aria-selected', String(active));
      entry.panel.classList.toggle('hidden', !active);
    });
    document.getElementById('masterBreadcrumb').textContent = master === 'item' ? 'Item' : master === 'account' ? 'Account' : master === 'department' ? 'Department' : master === 'warehouse' ? 'Warehouse' : 'Employee';
    document.getElementById('masterTitle').textContent = selected.title;
    document.getElementById('masterDescription').textContent = selected.description;
    addMasterRecordButton.innerHTML = `<i class="fa-solid fa-plus" aria-hidden="true"></i> Add ${selected.addLabel}`;
    addMasterRecordButton.disabled = !selected.ready;
    showMessage('', false);
  }

  function filteredItems() {
    const query = itemSearch.value.trim().toLowerCase();
    return items.filter((item) => {
      const categoryMatches = activeCategory === 'all' || item.category === activeCategory;
      const queryMatches = !query || [item.name, item.code, item.category, item.type]
        .some((value) => String(value || '').toLowerCase().includes(query));
      return categoryMatches && queryMatches;
    });
  }

  function renderCategories() {
    const categories = [...new Set([
      ...itemCategories,
      ...items.map((item) => item.category).filter(Boolean)
    ])].sort((first, second) => first.localeCompare(second));
    const categoryList = document.getElementById('categoryList');

    document.getElementById('categoryCount').textContent = String(categories.length);
    document.getElementById('allItemsCount').textContent = String(items.length);
    categoryList.innerHTML = categories.map((category) => {
      const count = items.filter((item) => item.category === category).length;
      return `<button class="category-option${activeCategory === category ? ' active' : ''}" type="button" data-category="${escapeHtml(category)}">
        <span>${escapeHtml(category)}</span><span class="category-count">${count}</span>
      </button>`;
    }).join('');

    document.querySelector('.category-option[data-category="all"]')
      .classList.toggle('active', activeCategory === 'all');
  }

  function renderItems() {
    const visibleItems = filteredItems();
    tableBody.innerHTML = visibleItems.map((item) => `
      <tr>
        <td class="master-id">${escapeHtml(item.id)}</td>
        <td class="item-name-cell">${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.code)}</td>
        <td>${escapeHtml(item.category || '—')}</td>
        <td>${escapeHtml(item.type || '—')}</td>
        <td><span class="gst-badge">${escapeHtml(item.gst)}%</span></td>
        <td>${escapeHtml(item.stock)}</td>
        <td><button class="row-action" type="button" data-edit-id="${escapeHtml(item.id)}" aria-label="Edit ${escapeHtml(item.name)}">
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
        </button></td>
      </tr>
    `).join('');

    const emptyState = document.getElementById('emptyState');
    const noItems = items.length === 0;
    document.querySelector('#emptyState h3').textContent = noItems ? 'No items yet' : 'No matching items';
    document.querySelector('#emptyState p').textContent = noItems
      ? 'Add an item to start building your catalogue.'
      : 'Try another search or choose a different category.';
    emptyState.classList.toggle('visible', visibleItems.length === 0);
    document.getElementById('itemsSummary').textContent =
      `Showing ${visibleItems.length} of ${items.length} ${items.length === 1 ? 'item' : 'items'}`;
    renderCategories();
  }

  function setActiveTab(panelId) {
    document.querySelectorAll('.form-tab').forEach((tab) => {
      const selected = tab.dataset.tab === panelId;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== panelId);
    });
  }

  function updateGstPreview() {
    const price = Number(priceInput.value) || 0;
    const rate = Number(gstSelect.value) || 0;
    document.getElementById('gstAmount').textContent =
      `₹${(price * rate / 100).toFixed(2)}`;
  }

  function openForm(item) {
    form.reset();
    itemBrandHint.hidden = true;
    editingId = item ? Number(item.id) : null;
    document.getElementById('formTitle').textContent = item ? 'Edit item' : 'Add item';
    document.getElementById('formBreadcrumb').textContent = item ? 'Edit item' : 'New item';
    document.querySelector('#itemForm button[type="submit"]').innerHTML =
      `<i class="fa-solid fa-check" aria-hidden="true"></i> ${item ? 'Save changes' : 'Save item'}`;

    if (item) {
      document.getElementById('itemName').value = item.name || '';
      document.getElementById('itemCode').value = item.code || '';
      document.getElementById('itemType').value = item.type || 'Finished goods';
      document.getElementById('itemCategory').value = item.category || '';
      document.getElementById('itemBrand').value = item.brand || '';
      document.getElementById('itemUnit').value = item.unit || 'Nos';
      document.getElementById('itemStock').value = item.stock ?? 0;
      document.getElementById('itemPrice').value = item.price ?? 0;
      document.getElementById('itemDescription').value = item.description || '';
      document.getElementById('itemGst').value = String(item.gst ?? 18);
      itemBrandHint.hidden = Boolean(item.brand);
    }

    setActiveTab('generalPanel');
    itemsView.classList.add('hidden');
    formPanel.classList.remove('hidden');
    showMessage('', false);
    updateGstPreview();
    document.getElementById('itemName').focus();
  }

  function closeForm() {
    formPanel.classList.add('hidden');
    itemsView.classList.remove('hidden');
    editingId = null;
    showMessage('', false);
  }

  function renderAccounts() {
    const query = accountSearch.value.trim().toLowerCase();
    const visibleAccounts = accounts.filter((account) =>
      [account.name, account.code, account.type, account.gstin, account.contact, account.phone]
        .some((value) => String(value || '').toLowerCase().includes(query))
    );
    accountTableBody.innerHTML = visibleAccounts.map((account) => `
      <tr>
        <td class="master-id">${escapeHtml(account.code)}</td>
        <td class="item-name-cell">${escapeHtml(account.name)}</td>
        <td>${escapeHtml(account.type || 'Vendor')}</td>
        <td>${escapeHtml(account.gstin || '—')}</td>
        <td>${escapeHtml(account.contact || '—')}</td>
        <td>${escapeHtml(account.phone || '—')}</td>
        <td>${escapeHtml(account.paymentTerms || '—')}</td>
        <td><button class="row-action" type="button" data-edit-account-id="${escapeHtml(account.id)}" aria-label="Edit ${escapeHtml(account.name)}">
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
        </button></td>
      </tr>
    `).join('');

    const emptyState = document.getElementById('accountEmptyState');
    const noAccounts = accounts.length === 0;
    emptyState.querySelector('h3').textContent = noAccounts ? 'No accounts yet' : 'No matching accounts';
    emptyState.querySelector('p').textContent = noAccounts
      ? 'Add a vendor account to use its details when creating purchase orders.'
      : 'Try another search.';
    emptyState.classList.toggle('visible', visibleAccounts.length === 0);
    document.getElementById('accountsSummary').textContent =
      `Showing ${visibleAccounts.length} of ${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'}`;
  }

  function renderDepartments() {
    departmentTableBody.innerHTML = departments.map((department) =>
      `<tr><td>${escapeHtml(department)}</td></tr>`
    ).join('');
    document.getElementById('departmentsSummary').textContent =
      `${departments.length} ${departments.length === 1 ? 'department' : 'departments'} available in Material Issue`;
  }

  function renderWarehouses() {
    warehouseTableBody.innerHTML = warehouses.map((warehouse) =>
      `<tr>
        <td class="item-name-cell">${escapeHtml(warehouse.name)}</td>
        <td>${escapeHtml([warehouse.address, warehouse.city, warehouse.state, warehouse.pincode].filter(Boolean).join(', ') || '—')}</td>
        <td>${escapeHtml(warehouse.shippingAddress || '—')}</td>
        <td>${escapeHtml(warehouse.gstin || '—')}</td>
        <td>${escapeHtml(warehouse.pan || '—')}</td>
        <td>${escapeHtml(warehouse.contact || '—')}</td>
        <td>${escapeHtml(warehouse.phone || '—')}</td>
        <td>${escapeHtml(warehouse.email || '—')}</td>
        <td><button class="row-action" type="button" data-edit-warehouse="${escapeHtml(warehouse.name)}" aria-label="Edit ${escapeHtml(warehouse.name)}">
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
        </button></td>
      </tr>`
    ).join('');
    document.getElementById('warehousesSummary').textContent =
      `${warehouses.length} ${warehouses.length === 1 ? 'warehouse' : 'warehouses'} available in Material Issue and Purchase Order`;
  }

  function renderEmployees() {
    employeeTableBody.innerHTML = employees.map((name) => `
      <tr>
        <td class="item-name-cell">${escapeHtml(name)}</td>
        <td><button class="row-action" type="button" data-edit-employee="${escapeHtml(name)}" aria-label="Edit ${escapeHtml(name)}">
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
        </button></td>
      </tr>
    `).join('');
    document.getElementById('employeesSummary').textContent =
      `${employees.length} ${employees.length === 1 ? 'employee' : 'employees'} available for Employee and Requested By fields`;
  }

  function closeEmployeeForm() {
    employeeForm.reset();
    employeeForm.classList.add('hidden');
    editingEmployeeName = null;
  }

  function openEmployeeForm(name = '') {
    employeeForm.reset();
    editingEmployeeName = name || null;
    employeeNameInput.value = name;
    document.getElementById('saveEmployeeBtn').innerHTML =
      `<i class="fa-solid fa-check" aria-hidden="true"></i> ${name ? 'Save changes' : 'Add employee'}`;
    employeeForm.classList.remove('hidden');
    employeeNameInput.focus();
  }

  function openWarehouseForm(warehouse = null) {
    warehouseForm.reset();
    editingWarehouseName = warehouse?.name || null;
    document.getElementById('saveWarehouseBtn').innerHTML =
      `<i class="fa-solid fa-check" aria-hidden="true"></i> ${warehouse ? 'Save changes' : 'Save warehouse'}`;
    if (warehouse) {
      Object.entries({
        newWarehouse: 'name',
        warehouseGstin: 'gstin',
        warehousePan: 'pan',
        warehouseContact: 'contact',
        warehousePhone: 'phone',
        warehouseEmail: 'email',
        warehouseAddress: 'address',
        warehouseShippingAddress: 'shippingAddress',
        warehouseCity: 'city',
        warehouseState: 'state',
        warehousePincode: 'pincode'
      }).forEach(([id, key]) => {
        document.getElementById(id).value = warehouse[key] || '';
      });
    }
    warehouseForm.classList.remove('hidden');
    newWarehouseInput.focus();
  }

  function closeWarehouseForm() {
    warehouseForm.reset();
    warehouseForm.classList.add('hidden');
    editingWarehouseName = null;
  }

  function openAccountForm(account) {
    accountForm.reset();
    editingAccountId = account ? Number(account.id) : null;
    document.getElementById('accountFormTitle').textContent = account ? 'Edit account' : 'Add account';
    document.getElementById('accountFormBreadcrumb').textContent = account ? 'Edit account' : 'New account';
    accountForm.querySelector('button[type="submit"]').innerHTML =
      `<i class="fa-solid fa-check" aria-hidden="true"></i> ${account ? 'Save changes' : 'Save account'}`;

    if (account) {
      document.getElementById('accountName').value = account.name || '';
      document.getElementById('accountCode').value = account.code || '';
      document.getElementById('accountType').value = account.type || 'Vendor';
      document.getElementById('accountContact').value = account.contact || '';
      document.getElementById('accountPhone').value = account.phone || '';
      document.getElementById('accountEmail').value = account.email || '';
      document.getElementById('accountGstin').value = account.gstin || '';
      document.getElementById('accountPan').value = account.pan || '';
      document.getElementById('accountAddress').value = account.address || '';
      document.getElementById('accountCity').value = account.city || '';
      document.getElementById('accountState').value = account.state || '';
      document.getElementById('accountPincode').value = account.pincode || '';
      document.getElementById('accountPaymentTerms').value = account.paymentTerms || 'Net 30';
    }

    accountsView.classList.add('hidden');
    accountFormPanel.classList.remove('hidden');
    showMessage('', false);
    document.getElementById('accountName').focus();
  }

  function closeAccountForm() {
    if (!accountFormPanel) return;
    accountFormPanel.classList.add('hidden');
    accountsView.classList.remove('hidden');
    editingAccountId = null;
  }

  document.querySelectorAll('.form-tab').forEach((tab) => {
    tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
  });

  document.querySelector('.category-panel').addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    activeCategory = button.dataset.category;
    renderItems();
  });

  tableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-id]');
    if (!button) return;
    const item = items.find((entry) => Number(entry.id) === Number(button.dataset.editId));
    if (item) openForm(item);
  });

  itemSearch.addEventListener('input', renderItems);
  priceInput.addEventListener('input', updateGstPreview);
  gstSelect.addEventListener('change', updateGstPreview);
  itemNameInput.addEventListener('input', () => {
    itemBrandHint.hidden = !itemNameInput.value.trim() || Boolean(itemBrandInput.value.trim());
  });
  itemBrandInput.addEventListener('input', () => {
    itemBrandHint.hidden = !itemNameInput.value.trim() || Boolean(itemBrandInput.value.trim());
  });

  document.querySelectorAll('[data-master]').forEach((tab) => {
    tab.addEventListener('click', () => switchMaster(tab.dataset.master));
  });
  addMasterRecordButton.addEventListener('click', () => {
    if (activeMaster === 'item') openForm();
    else if (activeMaster === 'account') openAccountForm();
    else if (activeMaster === 'department') newDepartmentInput.focus();
    else if (activeMaster === 'warehouse') openWarehouseForm();
    else openEmployeeForm();
  });
  document.querySelectorAll('[data-add-item]').forEach((button) => {
    button.addEventListener('click', () => openForm());
  });
  document.querySelectorAll('[data-add-account]').forEach((button) => {
    button.addEventListener('click', () => openAccountForm());
  });
  document.getElementById('closeFormBtn').addEventListener('click', closeForm);
  document.getElementById('cancelFormBtn').addEventListener('click', closeForm);
  document.getElementById('closeAccountFormBtn').addEventListener('click', closeAccountForm);
  document.getElementById('cancelAccountFormBtn').addEventListener('click', closeAccountForm);
  cancelWarehouseFormButton.addEventListener('click', closeWarehouseForm);
  document.getElementById('cancelEmployeeBtn').addEventListener('click', closeEmployeeForm);
  employeeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = employeeNameInput.value.trim();
    if (!name) {
      showMessage('Enter an employee name.', true);
      employeeNameInput.focus();
      return;
    }
    const isEditing = Boolean(editingEmployeeName);
    if (employees.some((entry) =>
      entry.toLocaleLowerCase() === name.toLocaleLowerCase()
      && entry.toLocaleLowerCase() !== String(editingEmployeeName || '').toLocaleLowerCase()
    )) {
      showMessage('This employee already exists.', true);
      employeeNameInput.focus();
      return;
    }
    try {
      employees = IMS.employeeSave(isEditing
        ? employees.map((entry) => entry === editingEmployeeName ? name : entry)
        : [...employees, name]);
      closeEmployeeForm();
      renderEmployees();
      showMessage(`Employee "${name}" ${isEditing ? 'updated' : 'added'} successfully.`, false);
    } catch (error) {
      showMessage(`Could not save employee: ${error.message}`, true);
    }
  });
  employeeTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-employee]');
    if (button) openEmployeeForm(button.dataset.editEmployee);
  });
  accountSearch.addEventListener('input', renderAccounts);
  departmentForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = newDepartmentInput.value.trim();
    if (!name) {
      showMessage('Enter a department name.', true);
      newDepartmentInput.focus();
      return;
    }
    if (departments.some((department) => department.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      showMessage('This department already exists.', true);
      newDepartmentInput.focus();
      return;
    }
    try {
      departments = IMS.departmentSave([...departments, name]);
      newDepartmentInput.value = '';
      renderDepartments();
      showMessage(`Department "${name}" added successfully.`, false);
    } catch (error) {
      showMessage(`Could not save department: ${error.message}`, true);
    }
  });
  warehouseForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = newWarehouseInput.value.trim();
    if (!name) {
      showMessage('Enter a warehouse name.', true);
      newWarehouseInput.focus();
      return;
    }
    if (warehouses.some((warehouse) =>
      warehouse.name.toLocaleLowerCase() === name.toLocaleLowerCase()
      && warehouse.name.toLocaleLowerCase() !== String(editingWarehouseName || '').toLocaleLowerCase()
    )) {
      showMessage('This warehouse already exists.', true);
      newWarehouseInput.focus();
      return;
    }
    try {
      const isEditing = Boolean(editingWarehouseName);
      const warehouse = {
        name,
        gstin: document.getElementById('warehouseGstin').value.trim().toUpperCase(),
        pan: document.getElementById('warehousePan').value.trim().toUpperCase(),
        contact: document.getElementById('warehouseContact').value.trim(),
        phone: document.getElementById('warehousePhone').value.trim(),
        email: document.getElementById('warehouseEmail').value.trim(),
        address: document.getElementById('warehouseAddress').value.trim(),
        shippingAddress: document.getElementById('warehouseShippingAddress').value.trim(),
        city: document.getElementById('warehouseCity').value.trim(),
        state: document.getElementById('warehouseState').value.trim(),
        pincode: document.getElementById('warehousePincode').value.trim()
      };
      const nextWarehouses = editingWarehouseName
        ? warehouses.map((entry) => entry.name === editingWarehouseName ? warehouse : entry)
        : [...warehouses, warehouse];
      warehouses = IMS.warehouseSave(nextWarehouses);
      closeWarehouseForm();
      renderWarehouses();
      showMessage(`Warehouse "${name}" ${isEditing ? 'updated' : 'added'} successfully.`, false);
    } catch (error) {
      showMessage(`Could not save warehouse: ${error.message}`, true);
    }
  });
  warehouseTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-warehouse]');
    if (!button) return;
    const warehouse = warehouses.find((entry) => entry.name === button.dataset.editWarehouse);
    if (warehouse) openWarehouseForm(warehouse);
  });

  accountTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-edit-account-id]');
    if (!button) return;
    const account = accounts.find((entry) => Number(entry.id) === Number(button.dataset.editAccountId));
    if (account) openAccountForm(account);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      setActiveTab('generalPanel');
      form.reportValidity();
      return;
    }

    const name = document.getElementById('itemName').value.trim();
    const code = document.getElementById('itemCode').value.trim();
    const brand = itemBrandInput.value.trim();
    if (!brand && editingId === null) {
      showMessage('Enter the item brand. It will be filled automatically in Purchase Indent.', true);
      setActiveTab('generalPanel');
      itemBrandInput.focus();
      return;
    }
    const duplicateCode = items.some((item) =>
      item.code.toLowerCase() === code.toLowerCase() && Number(item.id) !== editingId
    );
    if (duplicateCode) {
      showMessage('An item with this code already exists. Please use a unique code.', true);
      setActiveTab('generalPanel');
      document.getElementById('itemCode').focus();
      return;
    }

    const existingItem = items.find((item) => Number(item.id) === editingId);
    const item = {
      id: editingId ?? Math.max(0, ...items.map((entry) => Number(entry.id) || 0)) + 1,
      createdDate: existingItem?.createdDate || existingItem?.createdAt || new Date().toISOString().slice(0, 10),
      name,
      code,
      type: document.getElementById('itemType').value,
      category: document.getElementById('itemCategory').value.trim(),
      brand,
      unit: document.getElementById('itemUnit').value,
      stock: Number(document.getElementById('itemStock').value) || 0,
      price: Number(document.getElementById('itemPrice').value) || 0,
      gst: Number(gstSelect.value),
      description: document.getElementById('itemDescription').value.trim()
    };
    const nextItems = existingItem
      ? items.map((entry) => Number(entry.id) === editingId ? item : entry)
      : [...items, item];

    if (!persistItems(nextItems)) return;
    closeForm();
    renderItems();
    showMessage(`Item ${existingItem ? 'updated' : 'added'} successfully.`, false);
  });

  accountForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!accountForm.checkValidity()) {
      accountForm.reportValidity();
      return;
    }

    const name = document.getElementById('accountName').value.trim();
    const codeInput = document.getElementById('accountCode').value.trim();
    const existingAccount = accounts.find((account) => Number(account.id) === editingAccountId);
    let code = codeInput;
    if (!code) {
      let sequence = 1;
      do {
        code = `ACC-${String(sequence).padStart(4, '0')}`;
        sequence += 1;
      } while (accounts.some((account) => String(account.code || '').toLowerCase() === code.toLowerCase()));
    }

    const duplicateCode = accounts.some((account) =>
      String(account.code || '').toLowerCase() === code.toLowerCase()
      && Number(account.id) !== editingAccountId
    );
    if (duplicateCode) {
      showMessage('An account with this code already exists. Please use a unique code.', true);
      document.getElementById('accountCode').focus();
      return;
    }

    const account = {
      id: editingAccountId ?? Math.max(0, ...accounts.map((entry) => Number(entry.id) || 0)) + 1,
      name,
      code,
      type: document.getElementById('accountType').value,
      contact: document.getElementById('accountContact').value.trim(),
      phone: document.getElementById('accountPhone').value.trim(),
      email: document.getElementById('accountEmail').value.trim(),
      gstin: document.getElementById('accountGstin').value.trim().toUpperCase(),
      pan: document.getElementById('accountPan').value.trim().toUpperCase(),
      address: document.getElementById('accountAddress').value.trim(),
      city: document.getElementById('accountCity').value.trim(),
      state: document.getElementById('accountState').value.trim(),
      pincode: document.getElementById('accountPincode').value.trim(),
      paymentTerms: document.getElementById('accountPaymentTerms').value
    };
    const nextAccounts = existingAccount
      ? accounts.map((entry) => Number(entry.id) === editingAccountId ? account : entry)
      : [...accounts, account];

    if (!persistAccounts(nextAccounts)) return;
    closeAccountForm();
    renderAccounts();
    showMessage(`Account ${existingAccount ? 'updated' : 'added'} successfully.`, false);
  });

  try {
    items = loadItems();
  } catch (error) {
    itemsStorageReady = false;
    addMasterRecordButton.disabled = true;
    showMessage(`Could not load saved items: ${error.message}`, true);
  }

  if (!itemsStorageReady) {
    document.querySelectorAll('[data-add-item]').forEach((button) => {
      button.disabled = true;
    });
  }
  try {
    accounts = loadAccounts();
  } catch (error) {
    accountsStorageReady = false;
    showMessage(`Could not load saved accounts: ${error.message}`, true);
  }
  try {
    departments = IMS.departmentMaster();
  } catch (error) {
    departmentsStorageReady = false;
    showMessage(`Could not load saved departments: ${error.message}`, true);
  }
  try {
    warehouses = IMS.warehouseRecords();
  } catch (error) {
    warehousesStorageReady = false;
    showMessage(`Could not load saved warehouses: ${error.message}`, true);
  }
  try {
    employees = IMS.employeeMaster();
  } catch (error) {
    employeesStorageReady = false;
    showMessage(`Could not load saved employees: ${error.message}`, true);
  }
  if (!accountsStorageReady) {
    document.querySelectorAll('[data-add-account]').forEach((button) => {
      button.disabled = true;
    });
  }
  renderItems();
  renderAccounts();
  renderDepartments();
  renderWarehouses();
  renderEmployees();
  const requestedMaster = new URLSearchParams(window.location.search).get('master');
  switchMaster(['account', 'department', 'warehouse', 'employee'].includes(requestedMaster) ? requestedMaster : 'item');
  if (!itemsStorageReady) {
    showMessage('Could not load saved items. Check the browser storage data before adding items.', true);
  } else if (!accountsStorageReady) {
    showMessage('Could not load saved accounts. Check the browser storage data before adding accounts.', true);
  } else if (!departmentsStorageReady) {
    showMessage('Could not load saved departments. Check the browser storage data before adding departments.', true);
  } else if (!warehousesStorageReady) {
    showMessage('Could not load saved warehouses. Check the browser storage data before adding warehouses.', true);
  } else if (!employeesStorageReady) {
    showMessage('Could not load saved employees. Check the browser storage data before adding employees.', true);
  }
});
