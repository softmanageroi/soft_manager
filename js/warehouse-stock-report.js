(function (root) {
  const UNASSIGNED_WAREHOUSE = 'Unassigned warehouse';
  const APPROVED_STATUSES = new Set(['approved', 'authorized', 'issued', 'completed']);

  function normalizeCode(value) {
    return String(value || '').trim().toLocaleLowerCase();
  }

  function amount(value) {
    const quantity = Number(value);
    return Number.isFinite(quantity) ? quantity : 0;
  }

  function buildRows(items, receipts, vouchers) {
    const itemByCode = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const code = normalizeCode(item?.code || item?.itemCode);
      if (code) itemByCode.set(code, item);
    });

    const quantities = new Map();
    const receivedByCode = new Map();
    const warnings = new Set();
    const record = (line, warehouseValue, quantity, direction, departmentValue = '', isReceipt = false) => {
      const codeValue = String(line?.code || line?.itemCode || '').trim();
      const code = normalizeCode(codeValue);
      if (!code) return;
      const item = itemByCode.get(code);
      if (!item) {
        warnings.add(`Movement for item ${codeValue} was skipped because it is not in Item Master.`);
        return;
      }

      const warehouse = String(warehouseValue || '').trim() || UNASSIGNED_WAREHOUSE;
      const department = String(item.department || item.category || departmentValue || '').trim() || 'Uncategorized';
      const key = JSON.stringify([warehouse.toLocaleLowerCase(), department.toLocaleLowerCase(), code]);
      const current = quantities.get(key) || {
        warehouse,
        department,
        itemName: String(item.name || item.itemName || line.name || line.item || code),
        itemCode: String(item.code || item.itemCode || code),
        unit: String(item.unit || line.unit || 'Nos'),
        quantity: 0
      };
      current.quantity += amount(quantity) * direction;
      quantities.set(key, current);
      if (isReceipt) receivedByCode.set(code, (receivedByCode.get(code) || 0) + amount(quantity));
    };

    (Array.isArray(receipts) ? receipts : []).forEach((note) => {
      (Array.isArray(note?.lines) ? note.lines : []).forEach((line) => {
        const quantity = amount(line.receivedQty ?? line.qty);
        if (quantity > 0) record(line, note.warehouse, quantity, 1, '', true);
      });
    });

    (Array.isArray(vouchers) ? vouchers : []).forEach((voucher) => {
      const status = String(voucher?.authorizationStatus || voucher?.status || '').trim().toLocaleLowerCase();
      if (!APPROVED_STATUSES.has(status)) return;
      (Array.isArray(voucher.items) ? voucher.items : []).forEach((line) => {
        const quantity = amount(line.quantity ?? line.qty);
        if (quantity > 0) record(line, voucher.warehouse, quantity, -1, voucher.department);
      });
    });

    (Array.isArray(items) ? items : []).forEach((item) => {
      const code = normalizeCode(item?.code || item?.itemCode);
      if (!code) return;
      const openingQuantity = amount(item.stock) - (receivedByCode.get(code) || 0);
      if (openingQuantity > 0) {
        record({ ...item, code }, UNASSIGNED_WAREHOUSE, openingQuantity, 1);
      } else if (openingQuantity < 0) {
        warnings.add(`Item ${item.name || item.code} has less Item Master stock than recorded warehouse receipts; its unassigned opening balance is not shown.`);
      }
    });

    const rows = [...quantities.values()]
      .filter((row) => Math.abs(row.quantity) > 0.0005)
      .sort((first, second) =>
        first.warehouse.localeCompare(second.warehouse)
        || first.department.localeCompare(second.department)
        || first.itemName.localeCompare(second.itemName)
      );
    return { rows, warnings: [...warnings] };
  }

  const api = { buildRows, UNASSIGNED_WAREHOUSE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WarehouseStockReport = api;
})(typeof window !== 'undefined' ? window : globalThis);
