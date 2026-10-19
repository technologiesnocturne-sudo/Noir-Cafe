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

async function verifyTransaction(reference) {
  const { data } = await client().get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return data;
}

function isValidWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !Buffer.isBuffer(rawBody)) return false;
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(String(signatureHeader), 'utf8');
  // Constant-time comparison: a plain `===` leaks timing information proportional
  // to how many leading characters match, which can be used to forge a valid
  // signature byte-by-byte. The length check below is safe to short-circuit on
  // (the expected length is fixed and public — a SHA-512 hex digest), it's only
  // the byte-by-byte comparison that must be constant-time.
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

module.exports = { initializeTransaction, verifyTransaction, isValidWebhookSignature };
