window.addEventListener('DOMContentLoaded', function () {
  if (window.location.hostname.endsWith('.github.io')) {
    window.location.replace('dashboard.html');
    return;
  }

  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');
  const loginButton = document.getElementById('LoginButton');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  function showMessage(message) {
    if (!loginMessage) return;
    loginMessage.textContent = message;
    loginMessage.hidden = false;
  }

  function getPostLoginPath() {
    const storedNavigationKey = 'softManagerPendingNavigation';
    const nextPath = new URLSearchParams(window.location.search).get('next');
    let requestedPath = nextPath;
    if (!requestedPath) {
      const storedNavigation = sessionStorage.getItem(storedNavigationKey);
      if (storedNavigation) {
        try {
          const pending = JSON.parse(storedNavigation);
          if (typeof pending.path === 'string'
              && Number.isFinite(pending.createdAt)
              && Date.now() - pending.createdAt < 10 * 60 * 1000) {
            requestedPath = pending.path;
          }
        } catch (error) {
          console.error('Could not restore the pending page after login.', error);
        }
      }
    }

    if (!requestedPath) return '/html/dashboard.html';
    const target = new URL(requestedPath, window.location.origin);
    if (target.origin !== window.location.origin
        || !target.pathname.startsWith('/html/')
        || !target.pathname.endsWith('.html')
        || target.pathname === '/html/index.html') {
      return '/html/dashboard.html';
    }
    sessionStorage.removeItem(storedNavigationKey);
    return `${target.pathname}${target.search}${target.hash}`;
  }

  fetch('/api/auth/session', { credentials: 'same-origin' })
    .then((response) => {
      if (response.ok) window.location.replace(getPostLoginPath());
      else if (response.status !== 401) showMessage('Could not verify your login. Please restart the app and try again.');
    })
    .catch((error) => {
      console.error('Could not connect to the login service.', error);
      showMessage('Could not connect to the login service. Start the app with "node server.js" and open http://localhost:5001.');
    });

  loginForm?.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!usernameInput || !passwordInput || !loginButton) {
      console.error('Login could not start because required form elements are missing.');
      showMessage('Login form is unavailable. Reload the page and try again.');
      return;
    }

    loginButton.disabled = true;
    if (loginMessage) loginMessage.hidden = true;
    fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput.value,
        password: passwordInput.value
      })
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Login failed. Please try again.');
      window.location.replace(getPostLoginPath());
    }).catch((error) => {
      showMessage(error instanceof TypeError
        ? 'Could not connect to the login service. Start the app with "node server.js" and open http://localhost:5001.'
        : error.message);
      passwordInput.value = '';
      passwordInput.focus();
    }).finally(() => {
      loginButton.disabled = false;
    });
  });
});
