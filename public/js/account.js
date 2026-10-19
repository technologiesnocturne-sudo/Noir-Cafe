document.addEventListener('DOMContentLoaded', async () => {
  const user = Session.getUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  document.getElementById('account-name').textContent = user.full_name;
  document.getElementById('account-email').textContent = user.email;

  const list = document.getElementById('order-list');
  try {
    const { orders } = await api('/orders/my');
    if (!orders.length) {
      list.innerHTML = `
        <div class="empty-state">
          <span class="eyebrow">No orders yet</span>
          <h3>Your order history will show up here</h3>
          <a class="btn btn-primary" href="shop.html" style="margin-top:18px;">Browse the menu</a>
        </div>`;
      return;
    }

    list.innerHTML = orders.map((o) => `
      <a class="order-row" href="order-success.html?reference=${encodeURIComponent(o.order_number)}">
        <div>
          <div class="order-row-number">${escapeHtml(o.order_number)}</div>
          <div class="muted" style="font-size:0.85rem;">${new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
        <span class="status-pill status-${o.status}">${o.status.replace(/_/g, ' ')}</span>
        <span class="price">${formatGHS(o.total_pesewas)}</span>
      </a>`).join('');
  } catch (err) {
    list.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
  }
});
