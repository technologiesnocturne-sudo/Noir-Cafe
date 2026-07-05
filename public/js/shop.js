document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('product-grid');
  const filterBar = document.getElementById('filters');
  const searchInput = document.getElementById('search-input');

  const params = new URLSearchParams(window.location.search);
  let activeCategory = params.get('category') || '';
  let lastProducts = []; // cached so add-to-cart doesn't need a second fetch

  function cardHTML(p) {
    const outOfStock = p.stock <= 0;
    return `
      <div class="card">
        <a class="card-media" href="product.html?slug=${encodeURIComponent(p.slug)}">
          <img src="${p.image_url}" alt="${escapeHtml(p.name)}" loading="lazy">
        </a>
        <div class="card-body">
          <span class="card-cat">${escapeHtml(p.category_name || 'Noir Cafe')}</span>
          <h3 class="card-title"><a href="product.html?slug=${encodeURIComponent(p.slug)}">${escapeHtml(p.name)}</a></h3>
          <div class="card-foot">
            <span class="price">${formatGHS(p.price_pesewas)}</span>
            ${outOfStock
              ? '<span class="badge badge-out">Sold out</span>'
              : `<button class="btn btn-sm btn-primary" data-add="${p.id}">Add</button>`}
          </div>
        </div>
      </div>`;
  }

  async function loadCategories() {
    const { categories } = await api('/categories', { auth: false });
    const chips = [{ slug: '', name: 'All' }, ...categories];
    filterBar.innerHTML = chips
      .map((c) => `<button class="chip ${c.slug === activeCategory ? 'active' : ''}" data-cat="${c.slug}">${escapeHtml(c.name)}</button>`)
      .join('');
  }

  async function loadProducts() {
    grid.innerHTML = '<p class="muted">Loading the menu…</p>';
    const qs = new URLSearchParams();
    if (activeCategory) qs.set('category', activeCategory);
    if (searchInput && searchInput.value.trim()) qs.set('search', searchInput.value.trim());

    try {
      const { products } = await api(`/products?${qs.toString()}`, { auth: false });
      lastProducts = products;

      if (!products.length) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <span class="eyebrow">Nothing here yet</span>
            <h3>No items match that filter</h3>
            <p class="muted">Try a different category or clear your search.</p>
          </div>`;
        return;
      }
      grid.innerHTML = products.map(cardHTML).join('');
    } catch (err) {
      grid.innerHTML = `<p class="muted">Could not load the menu: ${escapeHtml(err.message)}</p>`;
    }
  }

  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    activeCategory = btn.dataset.cat;
    filterBar.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === btn));
    loadProducts();
  });

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const product = lastProducts.find((p) => p.id === Number(btn.dataset.add));
    if (!product) return;
    Cart.add(product, 1);
    showToast(`${product.name} added to cart`);
  });

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadProducts, 300);
    });
  }

  loadCategories().then(loadProducts);
});
