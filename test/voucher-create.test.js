const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createElement() {
  return {
    value: '',
    innerHTML: '',
    selectedIndex: 0,
    disabled: false,
    listeners: {},
    addEventListener(event, listener) {
      this.listeners[event] = listener;
    },
    setAttribute() {},
    removeAttribute() {}
  };
}

function createVoucherPage() {
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  };
  const itemsBody = getElement('voucherItemsBody');
  itemsBody.rows = [];
  itemsBody.replaceChildren = () => { itemsBody.rows = []; };
  itemsBody.appendChild = (row) => itemsBody.rows.push(row);

  const document = {
    addEventListener(event, listener) {
      this.listeners[event] = listener;
    },
    listeners: {},
    getElementById: getElement,
    createElement: () => {
      const inputs = Array.from({ length: 6 }, createElement);
      return {
        dataset: {},
        cells: [{ textContent: '' }],
        querySelectorAll: () => inputs
      };
    },
    querySelector: () => ({ appendChild() {} })
  };
  const storage = new Map();
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value))
  };
  const window = {
    location: { search: '', href: '' },
    alert() {},
    confirm: () => true
  };
  const IMS = {
    setEmployeeOptions() {},
    departmentMaster: () => ['MEP'],
    warehouseMaster: () => [],
    items: () => [],
    esc: (value) => String(value)
  };
  const context = {
    document,
    window,
    localStorage,
    IMS,
    URLSearchParams,
    console,
    Date,
    Number,
    String,
    Set,
    Array,
    Math,
    JSON
  };
  const source = fs.readFileSync(path.join(__dirname, '../js/voucher-create.js'), 'utf8');
  vm.runInNewContext(source, context);

  document.listeners.DOMContentLoaded();
  return { elements, itemsBody, storage };
}

test('does not consume a material issue voucher number until saved', () => {
  const { elements, itemsBody, storage } = createVoucherPage();
  const newVoucherButton = elements.get('newVoucherBtn');
  const firstNumber = elements.get('docNo').value;
  assert.match(firstNumber, /^MRIU\/\d{2}-\d{2}\/00001$/);
  assert.equal(storage.has(`materialRequisitionCounter:${firstNumber.split('/')[1]}`), false);

  newVoucherButton.listeners.click();
  assert.equal(elements.get('docNo').value, firstNumber);
  assert.equal(storage.has(`materialRequisitionCounter:${firstNumber.split('/')[1]}`), false);

  const inputs = itemsBody.rows[0].querySelectorAll('input');
  inputs[1].value = 'Test item';
  inputs[4].value = '2';
  elements.get('saveVoucherBtn').listeners.click();

  assert.equal(storage.get(`materialRequisitionCounter:${firstNumber.split('/')[1]}`), '1');
  assert.equal(JSON.parse(storage.get('materialRequisitionVouchers')).length, 1);

  newVoucherButton.listeners.click();
  assert.equal(elements.get('docNo').value, firstNumber.replace('00001', '00002'));
});
