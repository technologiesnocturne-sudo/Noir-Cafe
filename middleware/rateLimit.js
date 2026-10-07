const rateLimit = require('express-rate-limit');

function limiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });
}

// Brute-force protection on credentials.
const loginLimiter = limiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Please try again in 15 minutes.' });
const registerLimiter = limiter({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many sign-ups from this network. Please try again later.' });

// Order creation hits Paystack and the DB; verify is polled by the success page.
const orderLimiter = limiter({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many order requests. Please slow down.' });
const verifyLimiter = limiter({ windowMs: 5 * 60 * 1000, max: 60, message: 'Too many verification requests. Please slow down.' });

const adminLimiter = limiter({ windowMs: 15 * 60 * 1000, max: 300, message: 'Too many admin requests.' });

// NOTE: the Paystack webhook is deliberately NOT rate limited — it is authenticated by
// HMAC signature and dropping a legitimate delivery would lose a payment confirmation.
module.exports = { loginLimiter, registerLimiter, orderLimiter, verifyLimiter, adminLimiter };
