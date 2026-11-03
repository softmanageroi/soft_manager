const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildRows, UNASSIGNED_WAREHOUSE } = require('../js/warehouse-stock-report');

test('groups warehouse receipts and approved issues by item department', () => {
  const result = buildRows(
    [{ code: 'ITM-1', name: 'Water pump', department: 'MEP', unit: 'Nos', stock: 15 }],
    [{ warehouse: 'Main Store', lines: [{ code: 'ITM-1', receivedQty: 10 }] }],
    [
      { warehouse: 'Main Store', department: 'Civil', authorizationStatus: 'Approved', items: [{ code: 'ITM-1', quantity: 3 }] },
      { warehouse: 'Main Store', authorizationStatus: 'Pending', items: [{ code: 'ITM-1', quantity: 2 }] }
    ]
  );

  assert.deepEqual(result.rows, [
    { warehouse: 'Main Store', department: 'MEP', itemName: 'Water pump', itemCode: 'ITM-1', unit: 'Nos', quantity: 7 },
    { warehouse: UNASSIGNED_WAREHOUSE, department: 'MEP', itemName: 'Water pump', itemCode: 'ITM-1', unit: 'Nos', quantity: 5 }
  ]);
  assert.deepEqual(result.warnings, []);
});

test('keeps opening stock without a warehouse separate and flags inconsistent balances', () => {
  const result = buildRows(
    [
      { code: 'ITM-1', name: 'Opening item', category: 'Civil', stock: 4 },
      { code: 'ITM-2', name: 'Mismatch item', category: 'MEP', stock: 1 }
    ],
    [{ warehouse: 'Store A', lines: [{ code: 'ITM-2', receivedQty: 3 }] }],
    []
  );

  assert.equal(result.rows.length, 2);
  const opening = result.rows.find((row) => row.warehouse === UNASSIGNED_WAREHOUSE);
  const receipt = result.rows.find((row) => row.warehouse === 'Store A');
  assert.equal(opening.quantity, 4);
  assert.equal(receipt.quantity, 3);
  assert.match(result.warnings[0], /Mismatch item/);
});

test('reports movements that refer to items missing from Item Master', () => {
  const result = buildRows(
    [],
    [{ warehouse: 'Store A', lines: [{ code: 'MISSING', receivedQty: 1 }] }],
    []
  );

  assert.equal(result.rows.length, 0);
  assert.match(result.warnings[0], /MISSING/);
});
