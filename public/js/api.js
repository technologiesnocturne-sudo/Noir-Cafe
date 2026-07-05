/* global window */
const API_BASE = '/api';

const Session = {
  getToken() { return localStorage.getItem('nc_token'); },
  getUser() {
    try { return JSON.parse(localStorage.getItem('nc_user') || 'null'); }
    catch (e) { return null; }
  },
  set(token, user) {
    localStorage.setItem('nc_token', token);
    localStorage.setItem('nc_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('nc_token');
    localStorage.removeItem('nc_user');
  },
  isAdmin() {
    const u = Session.getUser();
    return !!u && u.role === 'admin';
  },
};

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = Session.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new Error('Could not reach the Noir Cafe server. Check your connection and try again.');
  }

  let data = {};
  try { data = await res.json(); } catch (e) { /* empty body, e.g. 204 */ }

  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Formats integer pesewas as a GHS price string, e.g. 8500 -> "GHS 85.00" */
function formatGHS(pesewas) {
  return `GHS ${(Number(pesewas) / 100).toFixed(2)}`;
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
