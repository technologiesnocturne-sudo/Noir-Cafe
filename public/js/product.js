document.addEventListener('DOMContentLoaded', async () => {
  const wrap = document.getElementById('product-detail');
  const slug = new URLSearchParams(window.location.search).get('slug');

  if (!slug) {
    wrap.innerHTML = '<p class="muted">No product specified.</p>';
    return;
  }

  let product;
  try {
    const data = await api(`/products/${encodeURIComponent(slug)}`, { auth: false });
    product = data.product;
  } catch (err) {
    wrap.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
    return;
  }

  document.title = `${product.name} — Noir Cafe`;
  const outOfStock = product.stock <= 0;

  wrap.innerHTML = `
    <div class="product-media">
      <img src="${product.image_url}" alt="${escapeHtml(product.name)}">
    </div>
    <div class="product-info">
      <span class="eyebrow">${escapeHtml(product.category_name || 'Noir Cafe')}</span>
      <h1>${escapeHtml(product.name)}</h1>
      <p>${escapeHtml(product.description || '')}</p>
      <div class="price" style="font-size:1.5rem; margin: 18px 0;">${formatGHS(product.price_pesewas)}</div>
      ${outOfStock ? '<span class="badge badge-out">Sold out</span>' : `
        <div class="stack" style="max-width:260px;">
          <div class="qty-control" id="qty-control">
            <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
            <span id="qty-value">1</span>
            <button type="button" data-step="1" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn btn-primary btn-block" id="add-to-cart-btn">Add to cart — ${formatGHS(product.price_pesewas)}</button>
        </div>`}
    </div>`;

  if (outOfStock) return;

  let qty = 1;
  const qtyValue = document.getElementById('qty-value');
  const addBtn = document.getElementById('add-to-cart-btn');

  document.getElementById('qty-control').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-step]');
    if (!btn) return;
    qty = Math.max(1, Math.min(product.stock, qty + Number(btn.dataset.step)));
    qtyValue.textContent = qty;
    addBtn.textContent = `Add to cart — ${formatGHS(product.price_pesewas * qty)}`;
  });

  addBtn.addEventListener('click', () => {
    Cart.add(product, qty);
    showToast(`${qty} × ${product.name} added to cart`);
  });
});
