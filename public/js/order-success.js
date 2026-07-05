document.addEventListener('DOMContentLoaded', async () => {
  const wrap = document.getElementById('order-result');
  const reference = new URLSearchParams(window.location.search).get('reference');

  if (!reference) {
    wrap.innerHTML = '<p class="muted">No order reference provided.</p>';
    return;
  }

  wrap.innerHTML = '<p class="muted"><span class="spinner"></span> Confirming your order…</p>';

  try {
    // /verify is safe to call repeatedly — it's a no-op once the order is no longer "pending".
    const { order, items } = await api(`/orders/verify/${encodeURIComponent(reference)}`, { auth: false });
    render(order, items);
  } catch (err) {
    // Already-paid orders being revisited (e.g. from Account) hit this branch fine via /orders/:orderNumber.
    try {
      const user = Session.getUser();
      const qs = user ? '' : ''; // guest lookups need ?email=, handled by account flow when logged out
      const { order, items } = await api(`/orders/${encodeURIComponent(reference)}`);
      render(order, items);
    } catch (err2) {
      wrap.innerHTML = `
        <div class="empty-state">
          <span class="eyebrow">Could not confirm this order</span>
          <h3>${escapeHtml(err.message)}</h3>
          <p class="muted">If you completed payment, check your email for confirmation or visit your account.</p>
          <a class="btn btn-ghost" href="shop.html" style="margin-top:18px;">Back to shop</a>
        </div>`;
    }
  }

  function render(order, items) {
    const isPaid = order.status !== 'pending' && order.status !== 'cancelled';
    document.title = `Order ${order.order_number} — Noir Cafe`;

    wrap.innerHTML = `
      <div class="text-center" style="margin-bottom:28px;">
        ${isPaid
          ? '<span class="ticket-stamp" style="border-color: var(--success); color: var(--success);">Paid</span>'
          : `<span class="status-pill status-${order.status}">${order.status.replace(/_/g, ' ')}</span>`}
        <h2 style="margin-top:18px;">${isPaid ? 'Thank you for your order' : 'Order received'}</h2>
        <p class="muted">Order <strong>${escapeHtml(order.order_number)}</strong> — we've sent a confirmation to ${escapeHtml(order.customer_email)}.</p>
      </div>
      <div class="ticket">
        <div class="eyebrow" style="color:var(--rust); margin-bottom:14px;">Noir Cafe — Receipt</div>
        ${items.map((i) => `
          <div class="ticket-row">
            <span><span class="qty">${i.quantity}×</span> ${escapeHtml(i.product_name)}</span>
            <span>${formatGHS(i.unit_price_pesewas * i.quantity)}</span>
          </div>`).join('')}
        <div class="ticket-row"><span>Delivery</span><span>${formatGHS(order.delivery_fee_pesewas)}</span></div>
        <div class="ticket-total"><span>Total</span><span>${formatGHS(order.total_pesewas)}</span></div>
        <div class="ticket-row" style="margin-top:14px; border-top:1px solid rgba(20,16,13,0.35); padding-top:14px;">
          <span>Deliver to</span><span style="text-align:right;">${escapeHtml(order.delivery_address)}, ${escapeHtml(order.delivery_city)}</span>
        </div>
      </div>
      <div class="text-center" style="margin-top:30px;">
        <a class="btn btn-ghost" href="shop.html">Continue shopping</a>
      </div>`;
  }
});
