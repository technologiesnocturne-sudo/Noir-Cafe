document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }

  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  // Swap "Login" for "Account" (and surface "Admin") when a session exists.
  const user = Session.getUser();
  const authLink = document.querySelector('[data-auth-link]');
  if (authLink) {
    if (user) {
      authLink.textContent = 'Account';
      authLink.href = 'account.html';
    } else {
      authLink.textContent = 'Login';
      authLink.href = 'login.html';
    }
  }
  const adminLink = document.querySelector('[data-admin-link]');
  if (adminLink) {
    adminLink.style.display = Session.isAdmin() ? '' : 'none';
  }

  // Highlight the current page in the nav.
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[href]').forEach((a) => {
    if (a.getAttribute('href') === current) a.classList.add('active');
  });
});
