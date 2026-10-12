window.login = function () {
  const username = document.getElementById('username');
  const password = document.getElementById('password');

  if (!username || !password) {
    window.location.replace(new URL('dashboard.html', window.location.href).href);
    return;
  }

  const userNameValue = username.value.trim();
  const passwordValue = password.value.trim();

  if (!userNameValue || !passwordValue) {
    window.alert('Please enter username and password.');
    return;
  }

  localStorage.setItem('loggedInUser', userNameValue);
  window.location.replace(new URL('dashboard.html', window.location.href).href);
};

window.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('loginForm');
  loginForm?.addEventListener('submit', function (event) {
    event.preventDefault();
    window.login();
  });
});
