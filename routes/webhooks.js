const express = require('express');
const { isValidWebhookSignature } = require('../utils/paystack');
const { markOrderPaidIfNeeded } = require('./orders');

const router = express.Router();

router.post('/paystack', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.body;

    if (!isValidWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid signature.' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    if (event.event === 'charge.success') {
      await markOrderPaidIfNeeded(event.data.reference, event.data);
    }

    res.sendStatus(200);
  } catch (err) {
    // Non-2xx makes Paystack retry the delivery, so a transient DB error can't lose a payment.
    console.error('Webhook processing error:', err);
    res.sendStatus(500);
  }
});

module.exports = router;
