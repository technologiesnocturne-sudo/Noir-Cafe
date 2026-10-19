document.addEventListener('DOMContentLoaded', async () => {
  const user = Session.getUser();
  if (!user || user.role !== 'admin') {
    window.location.href = '../login.html';
    return;
  }
  document.getElementById('admin-name').textContent = user.full_name;

  const view = document.body.dataset.view; // "dashboard" | "products" | "orders"

  if (view === 'dashboard') await loadStats();
  if (view === 'products') await initProducts();
  if (view === 'orders') await initOrders();

  // ---------------- Dashboard ----------------
  async function loadStats() {
    const statGrid = document.getElementById('stat-grid');
    const topList = document.getElementById('top-products');
    try {
      const stats = await api('/admin/stats');
      statGrid.innerHTML = `
        <div class="stat-card"><span class="eyebrow">Revenue (paid orders)</span><div class="value">${formatGHS(stats.revenue_pesewas)}</div></div>
        <div class="stat-card"><span class="eyebrow">Paid orders</span><div class="value">${stats.paid_orders}</div></div>
        <div class="stat-card"><span class="eyebrow">Pending orders</span><div class="value">${stats.pending_orders}</div></div>
        <div class="stat-card"><span class="eyebrow">Customers</span><div class="value">${stats.total_customers}</div></div>`;

      topList.innerHTML = stats.top_products.length
        ? stats.top_products.map((p) => `<div class="ticket-row"><span>${escapeHtml(p.product_name)}</span><span>${p.units_sold} sold</span></div>`).join('')
        : '<p class="muted">No paid orders yet.</p>';
    } catch (err) {
      statGrid.innerHTML = `<p class="muted">${escapeHtml(err.message)}</p>`;
    }
  }

  // ---------------- Products ----------------
  async function initProducts() {
    const tableBody = document.getElementById('product-table-body');
    const modalBackdrop = document.getElementById('product-modal');
    const modalForm = document.getElementById('product-form');
    const modalTitle = document.getElementById('product-modal-title');
    let categories = [];
    let editingId = null;

    async function loadCategories() {
      const { categories: cats } = await api('/categories', { auth: false });
      categories = cats;
      modalForm.elements.category_id.innerHTML =
        '<option value="">No category</option>' +
        cats.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    }

    async function loadProducts() {
      tableBody.innerHTML = `<tr><td colspan="6">Loading…</td></tr>`;
      const { products } = await api('/admin/products');
      if (!products.length) {
        tableBody.innerHTML = `<tr><td colspan="6" class="muted">No products yet — add your first one.</td></tr>`;
        return;
      }
      tableBody.innerHTML = products.map((p) => `
        <tr>
          <td><img class="table-thumb" src="${p.image_url || ''}" alt=""></td>
          <td>${escapeHtml(p.name)}${p.is_active ? '' : ' <span class="badge badge-out">inactive</span>'}</td>
          <td>${escapeHtml(p.category_name || '—')}</td>
          <td>${formatGHS(p.price_pesewas)}</td>
          <td>${p.stock}</td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="btn btn-sm btn-ghost" data-edit="${p.id}">Edit</button>
            <button class="btn btn-sm btn-ghost" data-delete="${p.id}">Remove</button>
          </td>
        </tr>`).join('');

      // attach product data for editing without a second fetch
      tableBody._products = products;
    }

    function openModal(product) {
      editingId = product ? product.id : null;
      modalTitle.textContent = product ? 'Edit product' : 'Add product';
      modalForm.reset();
      if (product) {
        modalForm.elements.name.value = product.name;
        modalForm.elements.description.value = product.description || '';
        modalForm.elements.price.value = (product.price_pesewas / 100).toFixed(2);
        modalForm.elements.category_id.value = product.category_id || '';
        modalForm.elements.image_url.value = product.image_url || '';
        modalForm.elements.stock.value = product.stock;
        modalForm.elements.is_featured.checked = !!product.is_featured;
        modalForm.elements.is_active.checked = !!product.is_active;
      } else {
        modalForm.elements.is_active.checked = true;
      }
      modalBackdrop.classList.add('open');
    }
    function closeModal() { modalBackdrop.classList.remove('open'); }

    document.getElementById('add-product-btn').addEventListener('click', () => openModal(null));
    document.getElementById('product-modal-close').addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

    tableBody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('[data-edit]');
      const deleteBtn = e.target.closest('[data-delete]');
      if (editBtn) {
        const product = tableBody._products.find((p) => p.id === Number(editBtn.dataset.edit));
        openModal(product);
      }
      if (deleteBtn) {
        if (!confirm('Remove this product from the menu? It will stay attached to past orders.')) return;
        await api(`/admin/products/${deleteBtn.dataset.delete}`, { method: 'DELETE' });
        showToast('Product removed');
        loadProducts();
      }
    });

    modalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(modalForm);
      const payload = {
        name: fd.get('name'),
        description: fd.get('description'),
        price_pesewas: Math.round(Number(fd.get('price')) * 100),
        category_id: fd.get('category_id') || null,
        image_url: fd.get('image_url'),
        stock: Number(fd.get('stock')) || 0,
        is_featured: modalForm.elements.is_featured.checked,
        is_active: modalForm.elements.is_active.checked,
      };
      try {
        if (editingId) {
          await api(`/admin/products/${editingId}`, { method: 'PUT', body: payload });
          showToast('Product updated');
        } else {
          await api('/admin/products', { method: 'POST', body: payload });
          showToast('Product added');
        }
        closeModal();
        loadProducts();
      } catch (err) {
        alert(err.message);
      }
    });

    await loadCategories();
    await loadProducts();
  }

  // ---------------- Orders ----------------
  async function initOrders() {
    const tableBody = document.getElementById('order-table-body');
    const statusFilter = document.getElementById('order-status-filter');
    const STATUSES = ['pending', 'paid', 'processing', 'out_for_delivery', 'completed', 'cancelled'];

    async function loadOrders() {
      tableBody.innerHTML = `<tr><td colspan="6">Loading…</td></tr>`;
      const qs = statusFilter.value ? `?status=${statusFilter.value}` : '';
      const { orders } = await api(`/admin/orders${qs}`);
      if (!orders.length) {
        tableBody.innerHTML = `<tr><td colspan="6" class="muted">No orders found.</td></tr>`;
        return;
      }
      tableBody.innerHTML = orders.map((o) => `
        <tr>
          <td>${escapeHtml(o.order_number)}</td>
          <td>${escapeHtml(o.customer_name)}<br><span class="muted" style="font-size:0.8rem;">${escapeHtml(o.customer_email)}</span></td>
          <td>${new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
          <td>${formatGHS(o.total_pesewas)}</td>
          <td>
            <select class="status-select" data-order="${o.id}">
              ${STATUSES.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s.replace(/_/g, ' ')}</option>`).join('')}
            </select>
          </td>
          <td><a class="btn btn-sm btn-ghost" href="../order-success.html?reference=${encodeURIComponent(o.order_number)}" target="_blank" rel="noopener">View</a></td>
        </tr>`).join('');
    }

    tableBody.addEventListener('change', async (e) => {
      const select = e.target.closest('[data-order]');
      if (!select) return;
      try {
        await api(`/admin/orders/${select.dataset.order}/status`, { method: 'PUT', body: { status: select.value } });
        showToast('Order status updated');
      } catch (err) {
        alert(err.message);
        loadOrders();
      }
    });

    statusFilter.addEventListener('change', loadOrders);
    await loadOrders();
  }
});
