(function () {
  const searchInput = document.getElementById('searchBox');
  const searchResults = document.getElementById('searchResults');

  if (!searchInput || !searchResults) return;
  searchInput.setAttribute('aria-controls', searchResults.id);
  searchInput.setAttribute('aria-expanded', 'false');

  const menuItems = [
    { label: 'Dashboard', href: 'dashboard.html' },
    { label: 'Master', href: 'item-master.html' },
    { label: 'Purchase Indent', href: 'purchase-indent.html' },
    { label: 'Request For Quotation', href: 'request-for-quotation.html' },
    { label: 'Quotation Receive', href: 'quotation-receive.html' },
    { label: 'Purchase Orders', href: 'purchase-order-creation.html?view=all' },
    { label: 'Material Receipt Note', href: 'material-receipt-note.html' },
    { label: 'Material Issue Vouchers', href: 'material-issue-list.html' },
    { label: 'Stock Ledger', href: 'stock-ledger.html' },
    { label: 'Material Authorize', href: 'material-authorize.html' },
    { label: 'Registers and Monthly Reports', href: 'registers.html' },
  ];

  function renderResults(term) {
    const query = term.trim().toLowerCase();
    if (!query) {
      searchResults.innerHTML = '';
      searchResults.classList.remove('show');
      searchInput.setAttribute('aria-expanded', 'false');
      return;
    }

    const filtered = menuItems.filter(item => item.label.toLowerCase().includes(query));
    searchResults.innerHTML = filtered.length
      ? filtered.map(item => `<li><a href="${item.href}">${item.label}</a></li>`).join('')
      : '<li class="empty-result">No matches found</li>';
    searchResults.classList.add('show');
    searchInput.setAttribute('aria-expanded', 'true');
  }

  searchInput.addEventListener('input', function (event) {
    renderResults(event.target.value);
  });

  searchInput.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      searchResults.innerHTML = '';
      searchResults.classList.remove('show');
      searchInput.setAttribute('aria-expanded', 'false');
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    const links = searchResults.querySelectorAll('a');
    if (!links.length || !searchResults.classList.contains('show')) return;

    event.preventDefault();
    links[event.key === 'ArrowDown' ? 0 : links.length - 1].focus();
  });

  searchResults.addEventListener('keydown', function (event) {
    const links = [...searchResults.querySelectorAll('a')];
    const currentIndex = links.indexOf(event.target.closest('a'));
    if (currentIndex < 0) return;

    if (event.key === 'Escape') {
      searchResults.innerHTML = '';
      searchResults.classList.remove('show');
      searchInput.setAttribute('aria-expanded', 'false');
      searchInput.focus();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      links[(currentIndex + direction + links.length) % links.length].focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      links[event.key === 'Home' ? 0 : links.length - 1].focus();
    }
  });

  document.addEventListener('click', function (event) {
    const clickedWithin = searchInput.contains(event.target) || searchResults.contains(event.target);
    if (!clickedWithin) {
      searchResults.innerHTML = '';
      searchResults.classList.remove('show');
      searchInput.setAttribute('aria-expanded', 'false');
    }
  });
})();
