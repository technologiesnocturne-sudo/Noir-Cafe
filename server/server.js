require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const { errorHandler, notFound } = require('../middleware/errorHandler');
const { loginLimiter, registerLimiter, orderLimiter, verifyLimiter, adminLimiter } = require('../middleware/rateLimit');

const authRoutes = require('../routes/auth');
const productRoutes = require('../routes/products');
const orderRoutes = require('../routes/orders');
const adminRoutes = require('../routes/admin');
const webhookRoutes = require('../routes/webhooks');

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false, // the storefront loads Google Fonts + the Paystack inline script
  })
);
// Behind Nginx/Cloudflare, trust the proxy so rate limits key on the real client IP.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Same-origin by default (the storefront is served by this app). Set CORS_ORIGINS
// (comma-separated) only if a separate frontend origin needs API access.
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin || process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
}));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// IMPORTANT: the Paystack webhook needs the *raw* body for signature verification,
// so it's mounted with express.raw() before the global JSON parser below.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());

// ---------- API routes ----------
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/orders/verify', verifyLimiter);
app.use('/api/auth', authRoutes);
app.use('/api', productRoutes); // exposes /api/products and /api/categories
app.use('/api/orders', (req, res, next) => (req.method === 'POST' ? orderLimiter(req, res, next) : next()), orderRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'noir-cafe-api' }));

// ---------- Static frontend ----------
app.use(express.static(path.join(__dirname, '..')));
app.use('/js', express.static(path.join(__dirname, '..', 'public', 'js')));
app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- 404 + error handling ----------
app.use('/api', notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Noir Cafe server running on http://localhost:${PORT}`);
});
