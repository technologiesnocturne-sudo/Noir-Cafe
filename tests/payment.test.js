const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Stub the DB module with a recording fake so these tests need no MySQL.
const dbPath = require.resolve(path.join(__dirname, '..', 'server', 'config', 'db'));
let order;
let queries;
const conn = {
  async beginTransaction() {},
  async commit() { queries.push('COMMIT'); },
  async rollback() { queries.push('ROLLBACK'); },
  release() {},
  async query(sql, params) {
    queries.push(sql.replace(/\s+/g, ' ').trim());
    if (/FROM orders WHERE payment_reference/i.test(sql)) return [[order], []];
    if (/FROM order_items/i.test(sql)) return [[{ product_id: 1, quantity: 2 }], []];
    if (/UPDATE products/i.test(sql)) return [{ affectedRows: 1 }, []];
    if (/UPDATE orders/i.test(sql)) { if (/'paid'/.test(sql)) order.status = 'paid'; else order.status = params[0]; }
    return [{ affectedRows: 1 }, []];
  },
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { getConnection: async () => conn, query: async () => [[], []] } };
const { markOrderPaidIfNeeded } = require('../routes/orders');

function fresh() {
  order = { id: 1, order_number: 'NC-1', status: 'pending', total_pesewas: 10000, currency: 'GHS' };
  queries = [];
}
const decremented = () => queries.some((q) => /UPDATE products/.test(q));

test('pending/ongoing Paystack status does NOT cancel the order (mobile-money race)', async () => {
  for (const status of ['pending', 'ongoing', 'processing', 'queued', 'abandoned']) {
    fresh();
    const r = await markOrderPaidIfNeeded('NC-1', { status, amount: 10000, currency: 'GHS' });
    assert.equal(r.reason, 'payment_pending', status);
    assert.equal(order.status, 'pending', `${status} must leave the order pending`);
  }
});

test('failed/reversed Paystack status cancels the order', async () => {
  for (const status of ['failed', 'reversed']) {
    fresh();
    const r = await markOrderPaidIfNeeded('NC-1', { status, amount: 10000, currency: 'GHS' });
    assert.equal(r.reason, 'payment_not_successful');
    assert.equal(order.status, 'cancelled');
  }
});

test('webhook success still works after an earlier verify saw "pending"', async () => {
  fresh();
  await markOrderPaidIfNeeded('NC-1', { status: 'pending' });
  const r = await markOrderPaidIfNeeded('NC-1', { status: 'success', amount: 10000, currency: 'GHS', channel: 'mobile_money' });
  assert.equal(r.ok, true);
  assert.equal(order.status, 'paid');
  assert.ok(decremented());
});

test('amount or currency mismatch is rejected and stock untouched', async () => {
  for (const data of [{ amount: 100, currency: 'GHS' }, { amount: 10000, currency: 'USD' }]) {
    fresh();
    const r = await markOrderPaidIfNeeded('NC-1', { status: 'success', ...data });
    assert.equal(r.reason, 'amount_mismatch');
    assert.equal(order.status, 'pending');
    assert.ok(!decremented());
  }
});

test('already-paid order is idempotent (no second stock decrement)', async () => {
  fresh();
  order.status = 'paid';
  const r = await markOrderPaidIfNeeded('NC-1', { status: 'success', amount: 10000, currency: 'GHS' });
  assert.equal(r.alreadyProcessed, true);
  assert.ok(!decremented());
});
