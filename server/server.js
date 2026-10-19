require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const { errorHandler, notFound } = require('../middleware/errorHandler');

const authRoutes = require('../routes/auth');
const productRoutes = require('../routes/products');
const orderRoutes = require('../routes/orders');
const adminRoutes = require('../routes/admin');
const webhookRoutes = require('../routes/webhooks');

const app = express();

// Trust the first proxy hop (needed for correct req.ip behind a load balancer /
// reverse proxy in production — without it, rate limiting below keys off the
// proxy's IP instead of the real client).
app.set('trust proxy', 1);

app.use(
  helmet({
    // The storefront loads Google Fonts and the Paystack inline-checkout script,
    // and relies on inline style="" attributes throughout the existing markup —
    // style-src stays permissive, but script/object/frame directives are locked
    // down instead of disabling CSP outright.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://js.paystack.co'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.paystack.co'],
        frameSrc: ['https://checkout.paystack.com', 'https://js.paystack.co'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  })
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || true,
  })
);
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// IMPORTANT: the Paystack webhook needs the *raw* body for signature verification,
// so it's mounted with express.raw() before the global JSON parser below.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());

// Generic API-wide rate limit — a baseline backstop against scripted abuse.
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Tighter limit on auth endpoints — these are brute-force targets
// (login/register) and must not be left to the generic API limit alone.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// Tighter limit on unauthenticated order lookup/verify endpoints — these
// accept an attacker-guessable reference with no login required, so they're
// the obvious target for enumeration/brute-force of customer order data.
const orderLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// ---------- API routes ----------
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', productRoutes); // exposes /api/products and /api/categories
app.use('/api/orders/verify', orderLookupLimiter);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'noir-cafe-api' }));

// ---------- Static frontend ----------
// Only the specific directories the frontend actually needs are exposed —
// never the project root. The project root also holds .env, .git,
// node_modules, package.json and the server/routes/middleware/database/utils
// source, so mounting express.static() on it (as this app previously did)
// serves all of that too: note that .git in particular is NOT blocked by
// serve-static's dotfile handling once a sub-path is requested (it only
// inspects the final path segment, e.g. "/.git/config" passes because
// "config" doesn't start with a dot) — so the full git history, including
// anything ever committed such as .env, becomes downloadable with plain
// HTTP GETs. Root-level page/style assets are instead served from an exact
// allowlist below, resolved to fixed filesystem paths (never built from the
// request), so no other file in the project root is ever reachable.
app.use('/js', express.static(path.join(__dirname, '..', 'public', 'js')));
app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));
app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin')));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/images', express.static(path.join(__dirname, '..', 'images')));

const ROOT = path.join(__dirname, '..');
const ROOT_STATIC_ALLOWLIST = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/shop.html': 'shop.html',
  '/product.html': 'product.html',
  '/cart.html': 'cart.html',
  '/checkout.html': 'checkout.html',
  '/order-success.html': 'order-success.html',
  '/login.html': 'login.html',
  '/register.html': 'register.html',
  '/account.html': 'account.html',
  '/contact.html': 'contact.html',
  '/404.html': '404.html',
  '/style.css': 'style.css',
};
app.get(Object.keys(ROOT_STATIC_ALLOWLIST), (req, res) => {
  res.sendFile(path.join(ROOT, ROOT_STATIC_ALLOWLIST[req.path]));
});

// ---------- 404 + error handling ----------
app.use('/api', notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Noir Cafe server running on http://localhost:${PORT}`);
});
