const express = require('express');
const pool = require('../server/config/db');
const { attachUserIfPresent, authRequired } = require('../middleware/auth');
const { initializeTransaction, verifyTransaction } = require('../utils/paystack');
const { generateOrderNumber } = require('../utils/orderNumber');

const router = express.Router();

const DELIVERY_FEE_PESEWAS = 1500; // flat GHS 15.00 delivery fee, kept simple on purpose

/**
 * Marks an order as paid (idempotent) and decrements stock.
 * Called from both the verify endpoint (customer redirect) and the webhook
 * (Paystack's authoritative async notification) — whichever arrives first wins.
 */
async function markOrderPaidIfNeeded(reference, paystackData) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [orders] = await conn.query(
      'SELECT * FROM orders WHERE payment_reference = ? FOR UPDATE',
      [reference]
    );
    if (!orders.length) {
      await conn.rollback();
      return { ok: false, reason: 'order_not_found' };
    }
    const order = orders[0];

    if (order.status !== 'pending') {
      await conn.rollback();
      return { ok: true, order, alreadyProcessed: true };
    }

    if (paystackData.status !== 'success') {
      await conn.query('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', order.id]);
      await conn.commit();
      return { ok: false, reason: 'payment_not_successful' };
    }

    const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);

    for (const item of items) {
      if (!item.product_id) continue;
      const [result] = await conn.query(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [item.quantity, item.product_id, item.quantity]
      );
      if (result.affectedRows === 0) {
        // Not enough stock left — proceed but flag for manual review rather than
        // failing a payment that has already been captured by Paystack.
        console.warn(`Stock shortfall for product ${item.product_id} on order ${order.order_number}`);
      }
    }

    await conn.query(
      `UPDATE orders SET status = 'paid', payment_channel = ?, paid_at = NOW() WHERE id = ?`,
      [paystackData.channel || null, order.id]
    );

    await conn.commit();
    return { ok: true, order: { ...order, status: 'paid' } };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// POST /api/orders — create an order and start a Paystack transaction
router.post('/', attachUserIfPresent, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { items, customer, delivery } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }
    if (!customer || !customer.name || !customer.email || !customer.phone) {
      return res.status(400).json({ error: 'Name, email and phone are required.' });
    }
    if (!delivery || !delivery.address || !delivery.city) {
      return res.status(400).json({ error: 'Delivery address and city are required.' });
    }

    // Re-price everything from the database — never trust client-supplied prices.
    const productIds = items.map((i) => Number(i.productId)).filter(Boolean);
    if (!productIds.length) return res.status(400).json({ error: 'Your cart is empty.' });

    const [products] = await conn.query(
      `SELECT id, name, price_pesewas, stock FROM products WHERE id IN (?) AND is_active = 1`,
      [productIds]
    );
    const productById = Object.fromEntries(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const lineItems = [];
    for (const item of items) {
      const product = productById[Number(item.productId)];
      const quantity = Math.max(1, Number(item.quantity) || 1);
      if (!product) {
        return res.status(400).json({ error: 'One or more items in your cart are no longer available.' });
      }
      if (product.stock < quantity) {
        return res.status(400).json({ error: `${product.name} only has ${product.stock} left in stock.` });
      }
      subtotal += product.price_pesewas * quantity;
      lineItems.push({ product, quantity });
    }

    const deliveryFee = DELIVERY_FEE_PESEWAS;
    const total = subtotal + deliveryFee;
    const orderNumber = generateOrderNumber();

    await conn.beginTransaction();

    const [orderResult] = await conn.query(
      `INSERT INTO orders
        (order_number, user_id, customer_name, customer_email, customer_phone,
         delivery_address, delivery_city, delivery_notes,
         subtotal_pesewas, delivery_fee_pesewas, total_pesewas, currency, status, payment_reference)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GHS', 'pending', ?)`,
      [
        orderNumber,
        req.user ? req.user.id : null,
        customer.name.trim(),
        customer.email.toLowerCase().trim(),
        customer.phone.trim(),
        delivery.address.trim(),
        delivery.city.trim(),
        delivery.notes ? delivery.notes.trim() : null,
        subtotal,
        deliveryFee,
        total,
        orderNumber, // payment_reference == order_number for easy lookup
      ]
    );
    const orderId = orderResult.insertId;

    for (const { product, quantity } of lineItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price_pesewas, quantity)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, product.id, product.name, product.price_pesewas, quantity]
      );
    }

    await conn.commit();

    const paystackResponse = await initializeTransaction({
      email: customer.email,
      amountPesewas: total,
      reference: orderNumber,
      callbackUrl: `${process.env.FRONTEND_URL}/order-success.html?reference=${orderNumber}`,
      metadata: { order_number: orderNumber, customer_name: customer.name },
    });

    res.status(201).json({
      orderNumber,
      total_pesewas: total,
      authorization_url: paystackResponse.data.authorization_url,
      access_code: paystackResponse.data.access_code,
      reference: paystackResponse.data.reference,
    });
  } catch (err) {
    try { await conn.rollback(); } catch (e) { /* no-op */ }
    next(err);
  } finally {
    conn.release();
  }
});

// GET /api/orders/verify/:reference — used by the order-success page after Paystack redirect
router.get('/verify/:reference', async (req, res, next) => {
  try {
    const { reference } = req.params;
    const paystackResponse = await verifyTransaction(reference);
    const result = await markOrderPaidIfNeeded(reference, paystackResponse.data);

    if (!result.ok && result.reason === 'order_not_found') {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (!result.ok) {
      return res.status(402).json({ error: 'Payment was not successful.' });
    }

    const [orderRows] = await pool.query('SELECT * FROM orders WHERE payment_reference = ?', [reference]);
    const [itemRows] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [orderRows[0].id]);

    res.json({ order: orderRows[0], items: itemRows });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/my — order history for the logged-in customer
router.get('/my', authRequired, async (req, res, next) => {
  try {
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:orderNumber — order detail, for the owner, a matching guest email, or an admin
router.get('/:orderNumber', attachUserIfPresent, async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const { email } = req.query;

    const [orders] = await pool.query('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found.' });
    const order = orders[0];

    const isOwner = req.user && order.user_id === req.user.id;
    const isAdmin = req.user && req.user.role === 'admin';
    const isMatchingGuest = email && email.toLowerCase() === order.customer_email;

    if (!isOwner && !isAdmin && !isMatchingGuest) {
      return res.status(403).json({ error: 'You do not have access to this order.' });
    }

    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    res.json({ order, items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.markOrderPaidIfNeeded = markOrderPaidIfNeeded;
