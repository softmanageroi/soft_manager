(() => {
  const ownerKey = '__soft_manager_mysql_user';
  const backupSummary = document.getElementById('backupSummary');
  const backupMessage = document.getElementById('backupMessage');
  const backupFile = document.getElementById('backupFile');
  const importBackupButton = document.getElementById('importBackupBtn');
  let selectedBackup = null;

  function getRecords() {
    const records = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key !== ownerKey) records[key] = localStorage.getItem(key);
    }
    return records;
  }

  function showMessage(message, isError = false) {
    backupMessage.textContent = message;
    backupMessage.hidden = !message;
    backupMessage.classList.toggle('error', isError);
  }

  function updateSummary() {
    const records = getRecords();
    const keys = Object.keys(records);
    const bytes = new Blob(Object.values(records)).size;
    backupSummary.textContent = `${keys.length} data records found (${(bytes / 1024).toFixed(1)} KB).`;
  }

  document.getElementById('exportBackupBtn').addEventListener('click', async () => {
    try {
      let storageWarning = '';
      if (window.APP_STORAGE_READY) {
        try {
          await window.APP_STORAGE_READY;
        } catch (error) {
          storageWarning = `Database startup failed; this backup contains only this browser's currently saved data. ${error.message}`;
        }
      }
      const backup = {
        format: 'soft-manager-backup',
        version: 1,
        createdAt: new Date().toISOString(),
        records: getRecords()
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json'
      }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `soft-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showMessage(storageWarning || 'Backup downloaded. Store the file somewhere private and safe.', Boolean(storageWarning));
    } catch (error) {
      showMessage(`Could not create backup: ${error.message}`, true);
    }
  });

  backupFile.addEventListener('change', async () => {
    selectedBackup = null;
    importBackupButton.disabled = true;
    const [file] = backupFile.files || [];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose a backup smaller than 10 MB.');
      const backup = JSON.parse(await file.text());
      const records = backup?.records;
      if (backup?.format !== 'soft-manager-backup' || backup.version !== 1
          || !records || typeof records !== 'object' || Array.isArray(records)) {
        throw new Error('This is not a supported Soft Manager backup file.');
      }
      const entries = Object.entries(records);
      if (entries.length > 2000 || entries.some(([key, value]) =>
        !key || key.length > 191 || key === ownerKey || typeof value !== 'string'
      )) {
        throw new Error('The backup contains invalid or unsupported data.');
      }
      selectedBackup = records;
      importBackupButton.disabled = entries.length === 0;
      showMessage(`Backup ready: ${entries.length} records from ${backup.createdAt || 'an earlier date'}.`);
    } catch (error) {
      showMessage(`Could not read backup: ${error.message}`, true);
    }
  });

  importBackupButton.addEventListener('click', async () => {
    if (!selectedBackup) return;
    const records = Object.entries(selectedBackup);
    const existing = getRecords();
    const overwritten = records.filter(([key]) => Object.hasOwn(existing, key)).length;
    const confirmed = window.confirm(
      `Restore ${records.length} records?${overwritten ? `\n\n${overwritten} existing records with matching keys will be replaced.` : ''}\n\nThis import stays in this browser; on the app server it will sync to the configured database.`
    );
    if (!confirmed) return;

    importBackupButton.disabled = true;
    let storageWarning = '';
    try {
      if (window.APP_STORAGE_READY) await window.APP_STORAGE_READY;
    } catch (error) {
      storageWarning = `Database startup failed; restored data is saved in this browser only. ${error.message}`;
    }

    try {
      records.forEach(([key, value]) => localStorage.setItem(key, value));
      if (window.APP_STORAGE?.flush) await window.APP_STORAGE.flush();
      showMessage(storageWarning || `Restored ${records.length} records. Check the app for any database save warnings.`, Boolean(storageWarning));
      updateSummary();
    } catch (error) {
      showMessage(`Restore did not complete: ${error.message}`, true);
    } finally {
      importBackupButton.disabled = false;
    }
  });

  updateSummary();
  if (window.APP_STORAGE_READY) {
    window.APP_STORAGE_READY.then(updateSummary, (error) => {
      showMessage(`Database startup failed; backup and restore will use this browser only. ${error.message}`, true);
    });
  }
})();
