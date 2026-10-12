document.addEventListener('DOMContentLoaded', function () {
  const topHome = document.querySelector('.top-home');
  if (topHome) {
    let topActions = topHome.closest('.top-actions');
    if (!topActions) {
      topActions = document.createElement('div');
      topActions.className = 'top-actions';
      topHome.parentNode.insertBefore(topActions, topHome);
      topActions.append(topHome);
    }

    let backButton = topActions.querySelector('.top-back');
    if (!backButton) {
      backButton = document.createElement('button');
      backButton.className = 'top-back';
      backButton.type = 'button';
      backButton.innerHTML = '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>Back</span>';
      backButton.setAttribute('aria-label', 'Go back');
      backButton.addEventListener('click', function () {
        if (document.body.classList.contains('po-form-active')) {
          document.getElementById('cancelOrderBtn')?.click();
          return;
        }
        if (document.body.classList.contains('mrn-form-active')) {
          document.getElementById('cancelMrnBtn')?.click();
          return;
        }
        if (window.history.length > 1) window.history.back();
        else window.location.assign(new URL('dashboard.html', window.location.href).href);
      });
    }

    let topUserLink = document.getElementById('topUserLink');
    if (!topUserLink) {
      topUserLink = document.createElement('a');
      topUserLink.id = 'topUserLink';
      topUserLink.className = 'top-user';
      topUserLink.href = 'index.html';
      topUserLink.setAttribute('aria-label', 'Login');
      topUserLink.innerHTML = '<i class="fa-solid fa-user" aria-hidden="true"></i><span id="topUserLabel"></span>';
    }

    // Keep the app's upper ribbon in the same order on every screen.
    topActions.append(topUserLink, backButton, topHome);
  }

  const topUserLink = document.getElementById('topUserLink');
  const topUserLabel = document.getElementById('topUserLabel');
  const loggedInUser = localStorage.getItem('loggedInUser') || 'username';
  if (!topUserLink || !topUserLabel) return;

  topUserLabel.textContent = `Login ID: ${loggedInUser}`;
  topUserLink.title = `Logged in as ${loggedInUser}`;
  topUserLink.setAttribute('aria-label', `Logged in as ${loggedInUser}. Select to switch user.`);
});
