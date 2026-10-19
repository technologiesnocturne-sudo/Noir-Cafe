const Cart = {
  KEY: 'nc_cart',

  get() {
    try { return JSON.parse(localStorage.getItem(Cart.KEY) || '[]'); }
    catch (e) { return []; }
  },

  save(items) {
    localStorage.setItem(Cart.KEY, JSON.stringify(items));
    Cart.renderBadge();
  },

  add(product, quantity = 1) {
    const items = Cart.get();
    const existing = items.find((i) => i.productId === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        price_pesewas: product.price_pesewas,
        image_url: product.image_url,
        quantity,
      });
    }
    Cart.save(items);
  },

  updateQuantity(productId, quantity) {
    let items = Cart.get();
    if (quantity <= 0) {
      items = items.filter((i) => i.productId !== productId);
    } else {
      const item = items.find((i) => i.productId === productId);
      if (item) item.quantity = quantity;
    }
    Cart.save(items);
  },

  remove(productId) {
    Cart.save(Cart.get().filter((i) => i.productId !== productId));
  },

  clear() {
    Cart.save([]);
  },

  count() {
    return Cart.get().reduce((sum, i) => sum + i.quantity, 0);
  },

  subtotal() {
    return Cart.get().reduce((sum, i) => sum + i.price_pesewas * i.quantity, 0);
  },

  renderBadge() {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = Cart.count();
    });
  },
};

document.addEventListener('DOMContentLoaded', Cart.renderBadge);
