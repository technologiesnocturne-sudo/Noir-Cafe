require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const { errorHandler, notFound } = require('../middleware/errorHandler');

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
app.use(cors());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// IMPORTANT: the Paystack webhook needs the *raw* body for signature verification,
// so it's mounted with express.raw() before the global JSON parser below.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());

// ---------- API routes ----------
app.use('/api/auth', authRoutes);
app.use('/api', productRoutes); // exposes /api/products and /api/categories
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

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
