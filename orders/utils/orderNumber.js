const crypto = require('crypto');

/** e.g. NC-260621-7F3A1C — date-stamped with a short random suffix. */
function generateOrderNumber() {
  const date = new Date();
  const y = String(date.getFullYear()).slice(2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `NC-${y}${m}${d}-${suffix}`;
}

module.exports = { generateOrderNumber };
