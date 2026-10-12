(function () {
  const searchInput = document.getElementById('searchBox');
  const searchResults = document.getElementById('searchResults');

  if (!searchInput || !searchResults) return;

  const menuItems = [
    { label: 'Dashboard', href: 'dashboard.html' },
    { label: 'Master', href: 'item-master.html' },
    { label: 'Purchase Indent', href: 'purchase-indent.html' },
    { label: 'Request For Quotation', href: 'request-for-quotation.html' },
    { label: 'Quotation Receive', href: 'quotation-receive.html' },
    { label: 'Purchase Orders', href: 'purchase-order-creation.html?view=all' },
    { label: 'Material Receipt Note', href: 'material-receipt-note.html' },
    { label: 'Inventory', href: 'inventory.html' },
    { label: 'Stock Ledger', href: 'stock-ledger.html' },
    { label: 'Material Requisition', href: 'inventory.html' },
    { label: 'Material Authorize', href: 'material-authorize.html' },
  ];

  function renderResults(term) {
    const query = term.trim().toLowerCase();
    if (!query) {
      searchResults.innerHTML = '';
      searchResults.classList.remove('show');
      return;
    }

    const filtered = menuItems.filter(item => item.label.toLowerCase().includes(query));
    searchResults.innerHTML = filtered.length
      ? filtered.map(item => `<li><a href="${item.href}">${item.label}</a></li>`).join('')
      : '<li class="empty-result">No matches found</li>';
    searchResults.classList.add('show');
  }

  searchInput.addEventListener('input', function (event) {
    renderResults(event.target.value);
  });

  document.addEventListener('click', function (event) {
    const clickedWithin = searchInput.contains(event.target) || searchResults.contains(event.target);
    if (!clickedWithin) {
      searchResults.innerHTML = '';
      searchResults.classList.remove('show');
    }
  });
})();
