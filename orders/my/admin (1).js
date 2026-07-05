const express = require('express');
const pool = require('../config/db');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, adminRequired);

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ---------- Dashboard ----------
// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const [[revenue]] = await pool.query(
      `SELECT COALESCE(SUM(total_pesewas), 0) AS revenue_pesewas, COUNT(*) AS paid_orders
       FROM orders WHERE status IN ('paid','processing','out_for_delivery','completed')`
    );
    const [[pending]] = await pool.query(`SELECT COUNT(*) AS pending_orders FROM orders WHERE status = 'pending'`);
    const [[customers]] = await pool.query(`SELECT COUNT(*) AS total_customers FROM users WHERE role = 'customer'`);
    const [topProducts] = await pool.query(
      `SELECT oi.product_name, SUM(oi.quantity) AS units_sold
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status IN ('paid','processing','out_for_delivery','completed')
       GROUP BY oi.product_name
       ORDER BY units_sold DESC
       LIMIT 5`
    );
    res.json({
      revenue_pesewas: revenue.revenue_pesewas,
      paid_orders: revenue.paid_orders,
      pending_orders: pending.pending_orders,
      total_customers: customers.total_customers,
      top_products: topProducts,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- Products ----------
// GET /api/admin/products
router.get('/products', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.created_at DESC`
    );
    res.json({ products: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/products
router.post('/products', async (req, res, next) => {
  try {
    const { name, description, price_pesewas, category_id, image_url, stock, is_featured, is_active } = req.body;
    if (!name || !price_pesewas) {
      return res.status(400).json({ error: 'Name and price are required.' });
    }
    const slug = slugify(name);
    const [result] = await pool.query(
      `INSERT INTO products (category_id, name, slug, description, price_pesewas, image_url, stock, is_featured, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category_id || null,
        name.trim(),
        slug,
        description || null,
        Number(price_pesewas),
        image_url || null,
        Number(stock) || 0,
        is_featured ? 1 : 0,
        is_active === false ? 0 : 1,
      ]
    );
    res.status(201).json({ id: result.insertId, slug });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A product with a similar name already exists.' });
    }
    next(err);
  }
});

// PUT /api/admin/products/:id
router.put('/products/:id', async (req, res, next) => {
  try {
    const { name, description, price_pesewas, category_id, image_url, stock, is_featured, is_active } = req.body;
    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?', 'slug = ?'); values.push(name.trim(), slugify(name)); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (price_pesewas !== undefined) { fields.push('price_pesewas = ?'); values.push(Number(price_pesewas)); }
    if (category_id !== undefined) { fields.push('category_id = ?'); values.push(category_id || null); }
    if (image_url !== undefined) { fields.push('image_url = ?'); values.push(image_url); }
    if (stock !== undefined) { fields.push('stock = ?'); values.push(Number(stock)); }
    if (is_featured !== undefined) { fields.push('is_featured = ?'); values.push(is_featured ? 1 : 0); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update.' });

    values.push(req.params.id);
    const [result] = await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/products/:id — soft delete (keeps order history intact)
router.delete('/products/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Categories ----------
// POST /api/admin/categories
router.post('/categories', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required.' });
    const slug = slugify(name);
    const [result] = await pool.query(
      'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)',
      [name.trim(), slug, description || null]
    );
    res.status(201).json({ id: result.insertId, slug });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A category with this name already exists.' });
    }
    next(err);
  }
});

// ---------- Orders ----------
// GET /api/admin/orders?status=paid
router.get('/orders', async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = status ? 'WHERE status = ?' : '';
    const params = status ? [status] : [];
    const [rows] = await pool.query(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC`,
      params
    );
    res.json({ orders: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/orders/:id
router.get('/orders/:id', async (req, res, next) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found.' });
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ order: orders[0], items });
  } catch (err) {
    next(err);
  }
});

const VALID_STATUSES = ['pending', 'paid', 'processing', 'out_for_delivery', 'completed', 'cancelled'];

// PUT /api/admin/orders/:id/status
router.put('/orders/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }
    const [result] = await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Order not found.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
