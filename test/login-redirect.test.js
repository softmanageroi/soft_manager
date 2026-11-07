const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const loginScript = readFileSync(require.resolve('../js/login.js'), 'utf8');
const dashboardScript = readFileSync(require.resolve('../js/dashboard.js'), 'utf8');

test('dashboard saves New Indent navigation before checking dashboard helpers', () => {
  const handlers = {};
  const storage = new Map();
  const actionHandlers = {};
  const newIndentAction = {
    href: 'http://localhost:3000/html/purchase-indent.html?view=new',
    addEventListener: (eventName, handler) => { actionHandlers[eventName] = handler; }
  };
  const context = {
    window: { location: { href: 'http://localhost:3000/html/dashboard.html' } },
    document: {
      addEventListener: (eventName, handler) => { handlers[eventName] = handler; },
      getElementById: () => null,
      querySelector: () => newIndentAction
    },
    sessionStorage: {
      setItem: (key, value) => storage.set(key, value)
    },
    URL,
    console
  };

  vm.runInNewContext(dashboardScript, context);
  handlers.DOMContentLoaded();
  actionHandlers.click();

  const pendingNavigation = JSON.parse(storage.get('softManagerPendingNavigation'));
  assert.equal(pendingNavigation.path, '/html/purchase-indent.html?view=new');
  assert.equal(Number.isFinite(pendingNavigation.createdAt), true);
});

test('login returns to the saved New Indent page after authentication', async () => {
  const handlers = {};
  const storage = new Map([[
    'softManagerPendingNavigation',
    JSON.stringify({
      path: '/html/purchase-indent.html?view=new',
      createdAt: Date.now()
    })
  ]]);
  const redirects = [];
  const form = {
    addEventListener: (eventName, handler) => { handlers[`form:${eventName}`] = handler; }
  };
  const username = { value: 'test-user' };
  const password = { value: 'test-password', focus() {} };
  const elements = {
    loginForm: form,
    loginMessage: { hidden: true, textContent: '' },
    LoginButton: { disabled: false },
    username,
    password
  };
  let fetchCount = 0;
  const context = {
    window: {
      location: {
        hostname: 'localhost',
        origin: 'http://localhost:3000',
        search: '',
        replace: (path) => redirects.push(path)
      },
      addEventListener: (eventName, handler) => { handlers[eventName] = handler; }
    },
    document: { getElementById: (id) => elements[id] },
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      removeItem: (key) => storage.delete(key)
    },
    URL,
    URLSearchParams,
    console,
    fetch: () => {
      fetchCount += 1;
      return fetchCount === 1
        ? Promise.resolve({ ok: false, status: 401 })
        : Promise.resolve({ ok: true, json: async () => ({ username: 'test-user' }) });
    }
  };

  vm.runInNewContext(loginScript, context);
  handlers.DOMContentLoaded();
  handlers['form:submit']({ preventDefault() {} });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(redirects, ['/html/purchase-indent.html?view=new']);
  assert.equal(storage.has('softManagerPendingNavigation'), false);
});
