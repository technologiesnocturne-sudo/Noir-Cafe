const mysql = require('mysql2/promise');

const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'noir_cafe',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
};

class MemoryPool {
  constructor() {
    this.categories = [
      { id: 1, name: 'Coffee Beans', slug: 'coffee-beans', description: 'Whole and ground beans roasted in-house.' },
      { id: 2, name: 'Brewed Coffee', slug: 'brewed-coffee', description: 'Ready-to-drink espresso based and filter coffee.' },
      { id: 3, name: 'Pastries', slug: 'pastries', description: 'Fresh-baked pairings for your cup.' },
      { id: 4, name: 'Merch', slug: 'merch', description: 'Cups, grinders and Noir Cafe gear.' },
    ];
    this.products = [
      { id: 1, name: 'Dark Roast', slug: 'dark-roast', description: 'Bold smoky roast', price_pesewas: 8500, image_url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=800&q=80', stock: 40, is_featured: 1, is_active: 1, category_id: 1, category_name: 'Coffee Beans', category_slug: 'coffee-beans' },
      { id: 2, name: 'Volta Sunrise Light Roast', slug: 'volta-sunrise-light-roast', description: 'Bright citrus roast', price_pesewas: 9200, image_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=800&q=80', stock: 35, is_featured: 1, is_active: 1, category_id: 1, category_name: 'Coffee Beans', category_slug: 'coffee-beans' },
      { id: 3, name: 'Noir Signature Espresso', slug: 'noir-signature-espresso', description: 'Double shot signature', price_pesewas: 1800, image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=800&q=80', stock: 999, is_featured: 1, is_active: 1, category_id: 2, category_name: 'Brewed Coffee', category_slug: 'brewed-coffee' },
    ];
    this.users = [];
    this.orders = [];
    this.orderItems = [];
    this.nextIds = { users: 1, products: 4, categories: 5, orders: 1, orderItems: 1 };
  }

  async query(sql, params = []) {
    const statement = String(sql).trim().toUpperCase();

    if (statement.startsWith('SELECT ID, NAME, SLUG, DESCRIPTION FROM CATEGORIES')) {
      return [this.categories.slice().sort((a, b) => a.name.localeCompare(b.name)), []];
    }

    if (statement.includes('FROM PRODUCTS P') || statement.includes('FROM PRODUCTS')) {
      let rows = this.products.filter((product) => product.is_active === 1);
      const category = params[0];
      const search = params[1];
      if (category) rows = rows.filter((product) => product.category_slug === category);
      if (search) rows = rows.filter((product) => product.name.toLowerCase().includes(String(search).toLowerCase()) || product.description.toLowerCase().includes(String(search).toLowerCase()));
      return [rows, []];
    }

    if (statement.includes('FROM USERS')) {
      if (statement.includes('WHERE EMAIL = ?')) {
        const [email] = params;
        const rows = this.users.filter((user) => user.email === email);
        return [rows, []];
      }
      if (statement.includes('WHERE ID = ?')) {
        const [id] = params;
        return [this.users.filter((user) => user.id === Number(id)), []];
      }
      return [this.users, []];
    }

    if (statement.includes('FROM ORDERS')) {
      if (statement.includes('WHERE USER_ID = ?')) {
        const [userId] = params;
        return [this.orders.filter((order) => order.user_id === Number(userId)).sort((a, b) => b.created_at - a.created_at), []];
      }
      if (statement.includes('WHERE ORDER_NUMBER = ?')) {
        const [orderNumber] = params;
        return [this.orders.filter((order) => order.order_number === orderNumber), []];
      }
      if (statement.includes('WHERE PAYMENT_REFERENCE = ?')) {
        const [reference] = params;
        return [this.orders.filter((order) => order.payment_reference === reference), []];
      }
      return [this.orders, []];
    }

    if (statement.includes('FROM ORDER_ITEMS')) {
      if (statement.includes('WHERE ORDER_ID = ?')) {
        const [orderId] = params;
        return [this.orderItems.filter((item) => item.order_id === Number(orderId)), []];
      }
      return [this.orderItems, []];
    }

    if (statement.startsWith('INSERT INTO USERS')) {
      const [fullName, email, phone, passwordHash, role] = params;
      const user = { id: this.nextIds.users++, full_name: fullName, email, phone, password_hash: passwordHash, role: role || 'customer', created_at: new Date().toISOString() };
      this.users.push(user);
      return [{ insertId: user.id, affectedRows: 1 }, []];
    }

    if (statement.startsWith('INSERT INTO ORDERS')) {
      const [orderNumber, userId, customerName, customerEmail, customerPhone, deliveryAddress, deliveryCity, deliveryNotes, subtotal, deliveryFee, total, currency, status, paymentReference] = params;
      const order = { id: this.nextIds.orders++, order_number: orderNumber, user_id: userId || null, customer_name: customerName, customer_email: customerEmail, customer_phone: customerPhone, delivery_address: deliveryAddress, delivery_city: deliveryCity, delivery_notes: deliveryNotes, subtotal_pesewas: subtotal, delivery_fee_pesewas: deliveryFee, total_pesewas: total, currency: currency || 'GHS', status: status || 'pending', payment_reference: paymentReference, payment_channel: null, paid_at: null, created_at: new Date().toISOString() };
      this.orders.push(order);
      return [{ insertId: order.id, affectedRows: 1 }, []];
    }

    if (statement.startsWith('INSERT INTO ORDER_ITEMS')) {
      const [orderId, productId, productName, unitPricePesewas, quantity] = params;
      const item = { id: this.nextIds.orderItems++, order_id: Number(orderId), product_id: productId, product_name: productName, unit_price_pesewas: unitPricePesewas, quantity: Number(quantity) };
      this.orderItems.push(item);
      return [{ insertId: item.id, affectedRows: 1 }, []];
    }

    if (statement.startsWith('UPDATE PRODUCTS')) {
      const match = String(sql).match(/WHERE id = \?/);
      if (match) {
        const id = Number(params[params.length - 1]);
        const product = this.products.find((entry) => entry.id === id);
        if (product) {
          if (String(sql).includes('stock = stock - ?')) {
            const quantity = Number(params[0]);
            product.stock = Math.max(0, product.stock - quantity);
          }
          if (String(sql).includes('is_active = 0')) {
            product.is_active = 0;
          }
        }
        return [{ affectedRows: product ? 1 : 0 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }

    if (statement.startsWith('UPDATE ORDERS')) {
      const id = Number(params[params.length - 1]);
      const order = this.orders.find((entry) => entry.id === id);
      if (order) {
        if (String(sql).includes('SET STATUS = ?')) {
          order.status = params[0];
        }
        if (String(sql).includes('SET STATUS = \'paid\'')) {
          order.status = 'paid';
        }
      }
      return [{ affectedRows: order ? 1 : 0 }, []];
    }

    return [[], []];
  }

  async getConnection() {
    return new MemoryConnection(this);
  }

  async end() {
    return null;
  }
}

class MemoryConnection {
  constructor(pool) {
    this.pool = pool;
    this.transactionActive = false;
  }

  async query(sql, params = []) {
    return this.pool.query(sql, params);
  }

  async beginTransaction() {
    this.transactionActive = true;
  }

  async commit() {
    this.transactionActive = false;
  }

  async rollback() {
    this.transactionActive = false;
  }

  release() {
    return null;
  }
}

let useMemoryMode = false;
let pool;
let memoryPool;

function createPrimaryPool() {
  return mysql.createPool(poolConfig);
}

async function initialize() {
  pool = createPrimaryPool();
  memoryPool = new MemoryPool();
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    useMemoryMode = true;
    console.warn('MySQL unavailable, using built-in in-memory store for local development.', err.message);
  }
}

const db = {
  async query(sql, params) {
    if (useMemoryMode) return memoryPool.query(sql, params);
    try {
      return await pool.query(sql, params);
    } catch (err) {
      useMemoryMode = true;
      return memoryPool.query(sql, params);
    }
  },
  async getConnection() {
    if (useMemoryMode) return memoryPool.getConnection();
    try {
      return await pool.getConnection();
    } catch (err) {
      useMemoryMode = true;
      return memoryPool.getConnection();
    }
  },
  async end() {
    if (pool) await pool.end();
    if (memoryPool) await memoryPool.end();
  },
};

initialize().catch(() => {
  useMemoryMode = true;
});

module.exports = db;
