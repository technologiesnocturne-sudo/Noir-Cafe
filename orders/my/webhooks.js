const express = require('express');
const { isValidWebhookSignature } = require('../utils/paystack');
const { markOrderPaidIfNeeded } = require('./orders');

const router = express.Router();

// POST /api/webhooks/paystack
// NOTE: this route must receive the *raw* request body (registered with
// express.raw() in server.js, mounted before the global express.json() parser)
// because signature verification is computed over the exact raw bytes.
router.post('/paystack', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.body; // Buffer, thanks to express.raw()

    if (!isValidWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid signature.' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));

    if (event.event === 'charge.success') {
      await markOrderPaidIfNeeded(event.data.reference, event.data);
    }

    // Always 200 quickly so Paystack doesn't retry unnecessarily.
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.sendStatus(200); // acknowledge receipt; we log and investigate separately
  }
});

module.exports = router;
