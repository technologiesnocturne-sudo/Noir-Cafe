document.addEventListener('DOMContentLoaded', () => {
  const summaryEl = document.getElementById('order-summary');
  const form = document.getElementById('checkout-form');
  const errorBox = document.getElementById('checkout-error');
  const submitBtn = document.getElementById('checkout-submit');

  const items = Cart.get();
  const DELIVERY_FEE_PESEWAS = 1500; // mirrors the flat fee applied server-side

  if (!items.length) {
    summaryEl.innerHTML = `
      <div class="empty-state">
        <span class="eyebrow">Your cart is empty</span>
        <h3>Add something delicious first</h3>
        <a class="btn btn-primary" href="shop.html" style="margin-top:18px;">Browse the menu</a>
      </div>`;
    form.style.display = 'none';
    return;
  }

  function renderSummary() {
    const subtotal = Cart.subtotal();
    const total = subtotal + DELIVERY_FEE_PESEWAS;
    summaryEl.innerHTML = `
      <div class="ticket">
        <div class="eyebrow" style="color:var(--rust); margin-bottom:14px;">Noir Cafe — Order Ticket</div>
        ${Cart.get().map((i) => `
          <div class="ticket-row">
            <span><span class="qty">${i.quantity}×</span> ${escapeHtml(i.name)}</span>
            <span>${formatGHS(i.price_pesewas * i.quantity)}</span>
          </div>`).join('')}
        <div class="ticket-row"><span>Delivery</span><span>${formatGHS(DELIVERY_FEE_PESEWAS)}</span></div>
        <div class="ticket-total"><span>Total</span><span>${formatGHS(total)}</span></div>
      </div>`;
  }
  renderSummary();

  // Pre-fill contact details for a logged-in customer.
  const user = Session.getUser();
  if (user) {
    form.elements.name.value = user.full_name || '';
    form.elements.email.value = user.email || '';
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add('visible');
  }
  function hideError() {
    errorBox.classList.remove('visible');
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.innerHTML = isLoading
      ? '<span class="spinner"></span> Processing…'
      : 'Continue to payment';
  }

  async function finalizeAndRedirect(reference) {
    try {
      await api(`/orders/verify/${encodeURIComponent(reference)}`, { auth: false });
    } catch (err) {
      // The webhook may confirm it shortly after even if this immediate check fails;
      // the success page will re-verify on load.
    }
    Cart.clear();
    window.location.href = `order-success.html?reference=${encodeURIComponent(reference)}`;
  }

  function openPaystackPopup({ accessCode, authorizationUrl, reference }) {
    if (typeof PaystackPop === 'undefined') {
      // Inline script failed to load (e.g. blocked) — fall back to hosted checkout.
      window.location.href = authorizationUrl;
      return;
    }
    const popup = new PaystackPop();
    popup.resumeTransaction(accessCode, {
      onSuccess: () => finalizeAndRedirect(reference),
      onCancel: () => setLoading(false),
      onError: (err) => {
        setLoading(false);
        showError(err && err.message ? err.message : 'The payment could not be started. Please try again.');
      },
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    setLoading(true);

    const fd = new FormData(form);
    const payload = {
      items: Cart.get().map((i) => ({ productId: i.productId, quantity: i.quantity })),
      customer: { name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone') },
      delivery: { address: fd.get('address'), city: fd.get('city'), notes: fd.get('notes') },
    };

    try {
      const order = await api('/orders', { method: 'POST', body: payload, auth: false });
      openPaystackPopup({
        accessCode: order.access_code,
        authorizationUrl: order.authorization_url,
        reference: order.reference,
      });
    } catch (err) {
      setLoading(false);
      showError(err.message);
    }
  });
});
