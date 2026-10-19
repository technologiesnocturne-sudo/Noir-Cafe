const crypto = require('crypto');

function generateOrderNumber() {
  const date = new Date();
  const y = String(date.getFullYear()).slice(2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  // 5 random bytes (40 bits, ~1.1 trillion combinations) rather than 3 (24 bits,
  // ~16.7 million) — this value doubles as the unauthenticated lookup key for
  // GET /api/orders/verify/:reference (needed for guest checkout), so it must
  // resist guessing even without the rate limiting added alongside this change.
  const suffix = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `NC-${y}${m}${d}-${suffix}`;
}

module.exports = { generateOrderNumber };
