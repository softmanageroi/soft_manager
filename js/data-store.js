(function () {
  const storage = window.localStorage;
  const ownerKey = '__soft_manager_mysql_user';
  const original = {
    clear: Storage.prototype.clear,
    getItem: Storage.prototype.getItem,
    key: Storage.prototype.key,
    removeItem: Storage.prototype.removeItem,
    setItem: Storage.prototype.setItem
  };
  const writes = new Map();
  const pending = new Set();
  let errorBanner;
  let activeUsername;

  function showStorageError(message) {
    if (!errorBanner) {
      errorBanner = document.createElement('div');
      errorBanner.setAttribute('role', 'alert');
      errorBanner.style.cssText = 'position:fixed;z-index:10000;top:0;left:0;right:0;padding:12px 18px;background:#8a1c1c;color:#fff;font:14px/1.4 sans-serif;text-align:center;';
      (document.body || document.documentElement).prepend(errorBanner);
    }
    errorBanner.textContent = message;
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || `Storage request failed (${response.status}).`);
      error.code = result.code;
      throw error;
    }
    return result;
  }

  function installStorageSync() {
    const enqueue = (key, operation) => {
      const previous = writes.get(key) || Promise.resolve();
      const current = previous.catch(() => {}).then(operation).catch((error) => {
        showStorageError(`MySQL save failed. Your latest change may not be stored on the server: ${error.message}`);
      });
      writes.set(key, current);
      pending.add(current);
      current.finally(() => pending.delete(current));
    };

    Object.defineProperty(Storage.prototype, 'setItem', {
      configurable: true,
      value(key, value) {
        original.setItem.call(this, key, value);
        if (this !== storage) return;
        const normalizedKey = String(key);
        if (normalizedKey === ownerKey) return;
        const normalizedValue = String(value);
        enqueue(normalizedKey, () => requestJson(`/api/data?key=${encodeURIComponent(normalizedKey)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: normalizedValue })
        }));
      }
    });

    Object.defineProperty(Storage.prototype, 'removeItem', {
      configurable: true,
      value(key) {
        original.removeItem.call(this, key);
        if (this !== storage) return;
        const normalizedKey = String(key);
        if (normalizedKey === ownerKey) {
          if (activeUsername) original.setItem.call(storage, ownerKey, activeUsername);
          return;
        }
        enqueue(normalizedKey, () => requestJson(`/api/data?key=${encodeURIComponent(normalizedKey)}`, {
          method: 'DELETE'
        }));
      }
    });

    Object.defineProperty(Storage.prototype, 'clear', {
      configurable: true,
      value() {
        if (this !== storage) {
          original.clear.call(this);
          return;
        }
        const keys = [];
        const owner = original.getItem.call(storage, ownerKey);
        for (let index = 0; index < storage.length; index += 1) {
          keys.push(original.key.call(storage, index));
        }
        original.clear.call(storage);
        if (owner) original.setItem.call(storage, ownerKey, owner);
        keys.filter((key) => key && key !== ownerKey).forEach((key) => {
          enqueue(key, () => requestJson(`/api/data?key=${encodeURIComponent(key)}`, {
            method: 'DELETE'
          }));
        });
      }
    });

    window.APP_STORAGE = {
      flush: () => Promise.all([...pending]),
      isConnected: true
    };
  }

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (type !== 'DOMContentLoaded' || !listener || (this !== document && this !== window)) {
      return originalAddEventListener.call(this, type, listener, options);
    }
    const target = this;
    const wrapped = function (event) {
      window.APP_STORAGE_READY.then(() => {
        if (typeof listener === 'function') listener.call(target, event);
        else listener.handleEvent.call(listener, event);
      }, () => {});
    };
    return originalAddEventListener.call(target, type, wrapped, options);
  };

  window.APP_STORAGE_READY = (async () => {
    const owner = original.getItem.call(storage, ownerKey);
    const localRecords = {};
    for (let index = 0; index < storage.length; index += 1) {
      const key = original.key.call(storage, index);
      if (key !== null && key !== ownerKey) {
        localRecords[key] = original.getItem.call(storage, key);
      }
    }

    let result;
    try {
      const session = await requestJson('/api/auth/session');
      activeUsername = session.username;
      if (owner && owner !== session.username) {
        Object.keys(localRecords).forEach((key) => delete localRecords[key]);
      }
      result = await requestJson('/api/data/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: localRecords })
      });
    } catch (error) {
      const mysqlIsNotConfigured = error.code === 'MYSQL_NOT_CONFIGURED'
        || error.message === 'MySQL storage is not configured. Set MYSQL_* values in .env and restart the server.';
      if (mysqlIsNotConfigured && activeUsername) {
        if (owner && owner !== activeUsername) original.clear.call(storage);
        original.setItem.call(storage, ownerKey, activeUsername);
        window.APP_STORAGE = {
          flush: () => Promise.resolve(),
          isConnected: false,
          mode: 'local'
        };
        return { imported: false, records: localRecords, storage: 'local' };
      }
      if (error.message.includes('Authentication required')) {
        window.location.replace('/html/index.html');
      }
      showStorageError(`MySQL storage is not ready. Configure the database and restart the app: ${error.message}`);
      throw error;
    }

    original.clear.call(storage);
    Object.entries(result.records).forEach(([key, value]) => {
      original.setItem.call(storage, key, value);
    });
    original.setItem.call(storage, ownerKey, activeUsername);
    installStorageSync();
    return { ...result, storage: 'mysql' };
  })();
})();
