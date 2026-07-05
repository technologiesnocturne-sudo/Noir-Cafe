const axios = require('axios');
const crypto = require('crypto');

function client() {
  return axios.create({
    baseURL: 'https://api.paystack.co',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

/**
 * Initialize a Paystack transaction in GHS.
 * amountPesewas: integer, smallest currency unit (GHS 1.00 = 100 pesewas).
 * Returns Paystack's data payload, including `authorization_url` to redirect the
 * customer to, and `access_code` for the inline popup.
 */
async function initializeTransaction({ email, amountPesewas, reference, callbackUrl, metadata }) {
  const { data } = await client().post('/transaction/initialize', {
    email,
    amount: amountPesewas,
    currency: 'GHS',
    reference,
    callback_url: callbackUrl,
    channels: ['card', 'mobile_money'],
    metadata,
  });
  return data;
}

/** Verify a transaction by reference. Source of truth for payment status. */
async function verifyTransaction(reference) {
  const { data } = await client().get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return data;
}

/** Validate the `x-paystack-signature` header on incoming webhooks (HMAC SHA-512). */
function isValidWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  return expected === signatureHeader;
}

module.exports = { initializeTransaction, verifyTransaction, isValidWebhookSignature };
