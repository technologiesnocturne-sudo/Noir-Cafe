# Noir Cafe

Full-stack e-commerce coffee shop — vanilla HTML/CSS/JS frontend, Node.js/Express backend, MySQL database, and **Paystack** payment integration for Ghana (MTN MoMo, Telecel Cash, AirtelTigo Money, and card payments in GHS).

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 18+, Express 4 |
| Database | MySQL 8+ |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Payments | Paystack (GHS · mobile money + cards) |
| Frontend | Vanilla HTML, CSS, JavaScript (no framework) |
| Fonts | Google Fonts — Fraunces, Work Sans, JetBrains Mono |

---

## Project structure

```
noir-cafe/
├── database/
│   ├── schema.sql          ← MySQL schema (run once)
│   └── seed.js             ← Populates categories, 12 products, admin account
├── server/
│   ├── server.js           ← Express app entry point
│   ├── config/db.js        ← MySQL connection pool
│   ├── middleware/
│   │   ├── auth.js         ← JWT middleware (authRequired, adminRequired)
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js         ← POST /api/auth/register|login, GET /api/auth/me
│   │   ├── products.js     ← GET /api/categories, /api/products, /api/products/:slug
│   │   ├── orders.js       ← POST /api/orders, GET /api/orders/verify/:ref, /api/orders/my
│   │   ├── admin.js        ← /api/admin/* (auth-gated)
│   │   └── webhooks.js     ← POST /api/webhooks/paystack
│   └── utils/
│       ├── paystack.js     ← initializeTransaction, verifyTransaction, webhook HMAC
│       └── orderNumber.js  ← NC-YYMMDD-XXXXXX generator
├── public/                 ← Static frontend served by Express
│   ├── css/style.css       ← Design tokens + shared components
│   ├── css/admin.css       ← Admin shell styles
│   ├── js/                 ← api.js, cart.js, main.js, shop.js, product.js,
│   │                          checkout.js, auth.js, account.js, order-success.js, admin.js
│   ├── admin/index.html    ← Admin dashboard (stats / products / orders)
│   └── *.html              ← Storefront pages
├── .env.example
├── package.json
└── README.md
```

---

## Local setup

### 1. Prerequisites

- Node.js ≥ 18
- MySQL 8 running locally (or a remote host)
- A [Paystack account](https://dashboard.paystack.com) — test keys work immediately, no approval needed for development

### 2. Clone & install

```bash
git clone <repo-url>
cd noir-cafe
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in every value:

```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:4000

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=noir_cafe

JWT_SECRET=<run: openssl rand -hex 32>
JWT_EXPIRES_IN=7d

# From https://dashboard.paystack.com/#/settings/developers
PAYSTACK_SECRET_KEY=sk_test_xxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxx

ADMIN_EMAIL=[email protected]
ADMIN_PASSWORD=ChangeMe123!
ADMIN_NAME=Noir Cafe Admin
```

### 4. Create the database & schema

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS noir_cafe CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p noir_cafe < database/schema.sql
```

### 5. Seed sample data

```bash
npm run seed
```

This creates 4 categories, 12 products (with Unsplash images), and the admin account defined in `.env`.

### 6. Start the server

```bash
npm run dev   # nodemon — auto-restarts on file changes
# or
npm start     # production
```

Visit [http://localhost:4000](http://localhost:4000).

**Default admin login:** use the email/password from your `.env`.  
Admin dashboard: [http://localhost:4000/admin/index.html](http://localhost:4000/admin/index.html)

---

## Payment integration (Paystack · Ghana)

### How it works

1. Customer fills the checkout form and submits.
2. Server re-prices the cart from the database, creates an `orders` row (status `pending`), then calls Paystack `POST /transaction/initialize` with `currency: "GHS"` and `channels: ["card", "mobile_money"]`.
3. Paystack returns an `access_code`. The frontend opens the **Paystack Popup V2** via `new PaystackPop().resumeTransaction(accessCode, { onSuccess, onCancel, onError })`.
4. The customer pays via their preferred method — the popup shows MTN MoMo, Telecel Cash, AirtelTigo Money, and card options automatically.
5. On success, the frontend calls `GET /api/orders/verify/:reference` which hits Paystack's verify API and marks the order `paid` (decrements stock).
6. Simultaneously, Paystack sends a `charge.success` webhook to `POST /api/webhooks/paystack` — the server validates the HMAC SHA-512 signature and runs the same `markOrderPaidIfNeeded` helper (idempotent — whichever arrives first wins).

### Supported Ghana payment channels

| Channel | Provider codes |
|---|---|
| MTN Mobile Money | `mtn` |
| Telecel Cash (formerly Vodafone Cash) | `vod` |
| AirtelTigo Money | `atl` |
| Card (Visa, Mastercard, gh-link) | handled by popup automatically |

All amounts are in **pesewas** (GHS minor unit). 100 pesewas = GHS 1.00.

### Webhook setup (required for mobile money)

Mobile money payments complete asynchronously — the webhook is the authoritative confirmation. For local development, use [ngrok](https://ngrok.com):

```bash
ngrok http 4000
# Copy the https URL, e.g. https://abc123.ngrok.io
```

In your Paystack dashboard → **Settings → API Keys & Webhooks**:
- Webhook URL: `https://abc123.ngrok.io/api/webhooks/paystack`
- Events to send: **charge.success** (at minimum)

In production, set `FRONTEND_URL` to your real domain and point the Paystack webhook to `https://yourdomain.com/api/webhooks/paystack`.

---

## API reference (summary)

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Register a customer |
| POST | `/api/auth/login` | None | Login → returns JWT |
| GET | `/api/auth/me` | JWT | Current user profile |

### Products
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/categories` | None | All categories |
| GET | `/api/products` | None | Products (filter: `category`, `search`, `featured`) |
| GET | `/api/products/:slug` | None | Single product |

### Orders
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/orders` | Optional | Create order + init Paystack transaction |
| GET | `/api/orders/verify/:ref` | None | Verify payment + mark paid |
| GET | `/api/orders/my` | JWT | Customer's order history |
| GET | `/api/orders/:orderNumber` | Owner/Admin/Guest+email | Order detail |

### Admin (JWT + admin role required)
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/stats` | Revenue, order counts, top products |
| GET/POST | `/api/admin/products` | List / create product |
| PUT/DELETE | `/api/admin/products/:id` | Update / soft-delete product |
| POST | `/api/admin/categories` | Create category |
| GET | `/api/admin/orders` | List orders (filter by `?status=`) |
| PUT | `/api/admin/orders/:id/status` | Update order status |

### Webhooks
| Method | Path | Description |
|---|---|---|
| POST | `/api/webhooks/paystack` | Receive Paystack charge events |

---

## Money handling

All prices in the database and in the API are stored as **integer pesewas** to avoid floating-point rounding. The helper `formatGHS(pesewas)` in `api.js` handles display formatting.

---

## Deployment notes

- Set `NODE_ENV=production` and `FRONTEND_URL` to your live domain.
- Use a process manager such as [PM2](https://pm2.keymetrics.io/): `pm2 start server/server.js --name noir-cafe`.
- Serve behind nginx or Caddy for TLS termination.
- Switch from Paystack test keys (`sk_test_…`) to live keys (`sk_live_…`) only after your Paystack business account is verified.
- Transaction fee on Paystack Ghana: 1.5% of transaction value, capped at GHS 60.
