window.addEventListener('DOMContentLoaded', function () {
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

  fetch('/api/auth/session', { credentials: 'same-origin' })
    .then((response) => {
      if (response.ok) window.location.replace('/html/dashboard.html');
      else if (response.status !== 401) showMessage('Could not verify your login. Please restart the app and try again.');
    })
    .catch((error) => {
      console.error('Could not connect to the login service.', error);
      showMessage('Could not connect to the login service. Start the app with "node server.js" and open http://localhost:3000.');
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
      window.location.replace('/html/dashboard.html');
    }).catch((error) => {
      showMessage(error instanceof TypeError
        ? 'Could not connect to the login service. Start the app with "node server.js" and open http://localhost:3000.'
        : error.message);
      passwordInput.value = '';
      passwordInput.focus();
    }).finally(() => {
      loginButton.disabled = false;
    });
  });
});
