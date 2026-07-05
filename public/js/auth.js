document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, no need to be here.
  if (Session.getUser() && (document.getElementById('login-form') || document.getElementById('register-form'))) {
    window.location.href = 'account.html';
    return;
  }

  function wireForm(formId, errorId, submitFn) {
    const form = document.getElementById(formId);
    if (!form) return;
    const errorBox = document.getElementById(errorId);
    const submitBtn = form.querySelector('[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.classList.remove('visible');
      submitBtn.disabled = true;
      const originalLabel = submitBtn.textContent;
      submitBtn.innerHTML = '<span class="spinner"></span>';

      try {
        await submitFn(new FormData(form));
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.add('visible');
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    });
  }

  wireForm('login-form', 'login-error', async (fd) => {
    const { token, user } = await api('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: fd.get('email'), password: fd.get('password') },
    });
    Session.set(token, user);
    window.location.href = user.role === 'admin' ? 'admin/index.html' : 'account.html';
  });

  wireForm('register-form', 'register-error', async (fd) => {
    const password = fd.get('password');
    const confirm = fd.get('confirmPassword');
    if (password !== confirm) throw new Error('Passwords do not match.');

    const { token, user } = await api('/auth/register', {
      method: 'POST',
      auth: false,
      body: { fullName: fd.get('fullName'), email: fd.get('email'), phone: fd.get('phone'), password },
    });
    Session.set(token, user);
    window.location.href = 'account.html';
  });

  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      Session.clear();
      window.location.href = 'index.html';
    });
  }
});
