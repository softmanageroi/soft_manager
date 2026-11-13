(function () {
  const pad = (value) => String(value).padStart(4, '0');
  const storageKey = 'voucherCounter';
  const existingCounter = Number(localStorage.getItem(storageKey) || 2000);
  const nextCounter = existingCounter + 1;
  localStorage.setItem(storageKey, String(nextCounter));

  const docField = document.getElementById('voucherNo') || document.getElementById('docNo') || document.getElementById('quotationNo') || document.getElementById('orderNo');

  if (docField && !docField.value) {
    docField.value = 'V-' + pad(nextCounter);
  }

  const autoDate = document.getElementById('voucherDate') || document.getElementById('date');
  if (autoDate && !autoDate.value) {
    const today = new Date();
    autoDate.value = today.toISOString().split('T')[0];
  }
})();
