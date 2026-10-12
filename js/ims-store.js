(function () {
  const KEYS = {
    items: 'ims_items',
    departments: 'ims_departments',
    warehouses: 'ims_warehouses',
    employees: 'ims_employees',
    pi: 'ims_pi',
    rfq: 'ims_rfq',
    qr: 'ims_qr',
    purchaseOrders: 'ims_purchase_orders',
    counters: 'ims_counters'
  };

  function read(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return value;
  }

  function array(key) {
    const value = read(key, []);
    if (!Array.isArray(value)) throw new TypeError(`Saved ${key} data must be an array.`);
    return value;
  }

  function financialYear(dateValue) {
    const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
    const year = date.getFullYear();
    const start = date.getMonth() >= 3 ? year : year - 1;
    return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
  }

  function voucherNo(prefix, dateValue, count) {
    return `${prefix}/${financialYear(dateValue)}/${String(count).padStart(5, '0')}`;
  }

  function nextCounter(prefix, dateValue, advance) {
    const counters = read(KEYS.counters, {});
    if (!counters || typeof counters !== 'object' || Array.isArray(counters)) {
      throw new TypeError('Saved voucher counters must be an object.');
    }
    const key = `${prefix}/${financialYear(dateValue)}`;
    const current = Number(counters[key]) || 0;
    const count = current + 1;
    if (advance) {
      counters[key] = count;
      localStorage.setItem(KEYS.counters, JSON.stringify(counters));
    }
    return voucherNo(prefix, dateValue, count);
  }

  function items() {
    const current = array(KEYS.items);
    const legacy = array('softManagerItems');
    const byCode = new Map();
    [...current, ...legacy].forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const code = String(item.code || item.itemCode || item.id || '');
      if (!code) return;
      byCode.set(code, {
        ...item,
        code,
        name: String(item.name || item.itemName || ''),
        category: String(item.category || item.department || ''),
        department: String(item.department || item.category || ''),
        brand: String(item.brand || ''),
        unit: String(item.unit || item.itemUnit || 'Nos'),
        rate: Number(item.rate ?? item.price ?? item.itemRate) || 0,
        stock: Number(item.stock) || 0,
        reorder: Number(item.reorder) || 0,
        description: String(item.description || '')
      });
    });
    const normalized = [...byCode.values()];
    localStorage.setItem(KEYS.items, JSON.stringify(normalized));
    return normalized;
  }

  function departments() {
    const saved = array(KEYS.departments);
    const fromItems = items().map((item) => item.department).filter(Boolean);
    return [...new Set([...saved, ...fromItems].map(String))].sort((a, b) => a.localeCompare(b));
  }

  function departmentMaster() {
    const standardDepartments = ['MEP', 'Civil', 'Housekeeping'];
    const saved = array(KEYS.departments);
    const seen = new Set();
    return [...standardDepartments, ...saved.map(String)].filter((department) => {
      const normalized = department.trim();
      const key = normalized.toLocaleLowerCase();
      if (!normalized || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function warehouseRecords() {
    const removedDefaults = new Set(['umbrella', 'main warehouse', 'central store']);
    const stored = array(KEYS.warehouses);
    const saved = stored.filter((entry) => {
      const name = typeof entry === 'string' ? entry : entry?.name;
      return !removedDefaults.has(String(name || '').trim().toLocaleLowerCase());
    });
    if (saved.length !== stored.length) {
      localStorage.setItem(KEYS.warehouses, JSON.stringify(saved));
    }
    const records = saved.map((entry) =>
      typeof entry === 'string' ? { name: entry } : entry
    );
    const byName = new Map();
    records.forEach((warehouse) => {
      if (!warehouse || typeof warehouse !== 'object') return;
      const name = String(warehouse.name || '').trim();
      if (!name) return;
      const key = name.toLocaleLowerCase();
      byName.set(key, { ...byName.get(key), ...warehouse, name });
    });
    return [...byName.values()];
  }

  function warehouseMaster() {
    return warehouseRecords().map((warehouse) => warehouse.name);
  }

  function employeeMaster() {
    const seen = new Set();
    return array(KEYS.employees).map((entry) => String(entry || '').trim()).filter((name) => {
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function setEmployeeOptions(select, selectedName = '') {
    if (!select) return;
    const selected = String(selectedName || '').trim();
    const employees = employeeMaster();
    select.replaceChildren(new Option('Select employee / requested by', ''));
    employees.forEach((name) => select.add(new Option(name, name)));
    if (selected && !employees.some((name) => name.toLocaleLowerCase() === selected.toLocaleLowerCase())) {
      select.add(new Option(selected, selected));
    }
    select.value = selected;
  }

  function consumedStatus(lines) {
    const total = lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
    const consumed = lines.reduce((sum, line) => sum + (Number(line.consumed) || 0), 0);
    if (consumed <= 0) return 'Pending';
    if (consumed >= total) return 'Closed';
    return 'Partial Consumed';
  }

  function saveArray(key, list) {
    if (!Array.isArray(list)) throw new TypeError(`Saved ${key} data must be an array.`);
    localStorage.setItem(key, JSON.stringify(list));
    return list;
  }

  window.IMS = {
    items,
    departments,
    departmentMaster,
    departmentSave: (list) => saveArray(KEYS.departments, list),
    warehouseMaster,
    warehouseRecords,
    warehouseSave: (list) => saveArray(KEYS.warehouses, list),
    employeeMaster,
    employeeSave: (list) => saveArray(KEYS.employees, list),
    setEmployeeOptions,
    piAll: () => array(KEYS.pi),
    piSave: (list) => saveArray(KEYS.pi, list),
    rfqAll: () => array(KEYS.rfq),
    rfqSave: (list) => saveArray(KEYS.rfq, list),
    qrAll: () => array(KEYS.qr),
    qrSave: (list) => saveArray(KEYS.qr, list),
    purchaseOrders: () => array(KEYS.purchaseOrders),
    purchaseOrdersSave: (list) => saveArray(KEYS.purchaseOrders, list),
    peekNo: (prefix, date) => nextCounter(prefix, date, false),
    nextNo: (prefix, date) => nextCounter(prefix, date, true),
    esc: (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]),
    todayISO: () => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },
    fmtDate: (iso) => {
      if (!iso) return '';
      const [year, month, day] = String(iso).split('-');
      return year && month && day ? `${day}/${month}/${year}` : String(iso);
    },
    uid: () => (window.crypto && typeof window.crypto.randomUUID === 'function')
      ? window.crypto.randomUUID()
      : `ims-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    piStatus: (pi) => consumedStatus(Array.isArray(pi.lines) ? pi.lines : []),
    rfqStatus: (rfq) => consumedStatus(Array.isArray(rfq.lines) ? rfq.lines : [])
  };
})();
