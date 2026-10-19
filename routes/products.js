const express = require('express');
const pool = require('../server/config/db');

const router = express.Router();

// GET /api/categories
router.get('/categories', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, name, slug, description FROM categories ORDER BY name');
    res.json({ categories: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/products?category=coffee-beans&search=dark&featured=1
router.get('/products', async (req, res, next) => {
  try {
    const { category, search, featured } = req.query;
    const clauses = ['p.is_active = 1'];
    const params = [];

    if (category) {
      clauses.push('c.slug = ?');
      params.push(category);
    }
    if (search) {
      clauses.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (featured === '1' || featured === 'true') {
      clauses.push('p.is_featured = 1');
    }

    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.slug, p.description, p.price_pesewas, p.image_url, p.stock,
              p.is_featured, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY p.is_featured DESC, p.created_at DESC`,
      params
    );
    res.json({ products: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:slug
router.get('/products/:slug', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.name, p.slug, p.description, p.price_pesewas, p.image_url, p.stock,
              p.is_featured, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.slug = ? AND p.is_active = 1`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
