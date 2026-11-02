const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createElement() {
  return {
    innerHTML: '',
    hidden: false,
    textContent: '',
    listeners: {},
    classList: { toggle() {} },
    addEventListener(event, listener) {
      this.listeners[event] = listener;
    }
  };
}

test('all vouchers tab includes rejected records hidden from pending tab', () => {
  const vouchers = [
    { docNo: 'MRIU/26-27/00006', date: '2026-10-10', department: 'MEP', requestedBy: 'User', authorizationStatus: 'Rejected' },
    { docNo: 'MRIU/26-27/00007', date: '2026-10-11', department: 'Civil', requestedBy: 'User', authorizationStatus: 'Pending' }
  ];
  const elements = new Map();
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  };
  const document = {
    listeners: {},
    addEventListener(event, listener) {
      this.listeners[event] = listener;
    },
    getElementById: getElement
  };
  const window = {
    IMS: {
      esc: (value) => String(value ?? ''),
      fmtDate: (value) => value
    },
    location: {}
  };
  const localStorage = {
    getItem: (key) => key === 'materialRequisitionVouchers' ? JSON.stringify(vouchers) : null
  };
  const context = { document, window, localStorage, IMS: window.IMS, URLSearchParams, Set, String, Array };
  const source = fs.readFileSync(path.join(__dirname, '../js/material-issue-list.js'), 'utf8');
  vm.runInNewContext(source, context);

  document.listeners.DOMContentLoaded();

  assert.match(elements.get('issueAllBody').innerHTML, /MRIU\/26-27\/00006/);
  assert.match(elements.get('issueAllBody').innerHTML, /status-rejected">Rejected/);
  assert.match(elements.get('issueAllBody').innerHTML, /MRIU\/26-27\/00007/);
  assert.equal(elements.get('issueCount').textContent, '2');
  assert.doesNotMatch(elements.get('issuePendingBody').innerHTML, /MRIU\/26-27\/00006/);
});
