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
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  return expected === signatureHeader;
}

module.exports = { initializeTransaction, verifyTransaction, isValidWebhookSignature };
