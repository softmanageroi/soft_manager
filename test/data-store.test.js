const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const dataStoreScript = readFileSync(require.resolve('../js/data-store.js'), 'utf8');

test('keeps the app usable with a clear warning when MySQL storage is unavailable', async () => {
  class Storage {
    constructor(entries = {}) {
      this.values = new Map(Object.entries(entries));
    }

    get length() {
      return this.values.size;
    }

    clear() {
      this.values.clear();
    }

    getItem(key) {
      return this.values.get(String(key)) ?? null;
    }

    key(index) {
      return [...this.values.keys()][index] ?? null;
    }

    removeItem(key) {
      this.values.delete(String(key));
    }

    setItem(key, value) {
      this.values.set(String(key), String(value));
    }
  }
  class EventTarget {}

  const warning = { style: {}, setAttribute() {}, textContent: '' };
  const body = { prepend() {} };
  const storage = new Storage({ inventoryItems: '[{"code":"A-1"}]' });
  const calls = [];
  const context = {
    Storage,
    EventTarget,
    window: { localStorage: storage, location: { replace() {} } },
    document: {
      body,
      documentElement: body,
      createElement: () => warning
    },
    fetch: async (url) => {
      calls.push(url);
      if (url === '/api/auth/session') {
        return { ok: true, status: 200, json: async () => ({ username: 'test-user' }) };
      }
      return {
        ok: false,
        status: 503,
        json: async () => ({
          code: 'MYSQL_STORAGE_UNAVAILABLE',
          error: 'MySQL storage is temporarily unavailable.'
        })
      };
    }
  };

  vm.runInNewContext(dataStoreScript, context);
  const result = await context.window.APP_STORAGE_READY;

  assert.deepEqual(calls, ['/api/auth/session', '/api/data/migrate']);
  assert.equal(result.storage, 'local');
  assert.equal(context.window.APP_STORAGE.mode, 'local');
  assert.equal(storage.getItem('inventoryItems'), '[{"code":"A-1"}]');
  assert.equal(warning.textContent.includes('saved only in this browser'), true);
});
