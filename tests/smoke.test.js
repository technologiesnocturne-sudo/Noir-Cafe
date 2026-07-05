const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const serverPath = path.join(__dirname, '..', 'server', 'server.js');

let child;

test.before(async () => {
  child = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '4100' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    child.stderr.on('data', (chunk) => {
      const msg = chunk.toString();
      if (msg.includes('running on')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stdout.on('data', (chunk) => {
      const msg = chunk.toString();
      if (msg.includes('running on')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on('exit', (code) => reject(new Error(`Server exited early with code ${code}`)));
  });
});

test.after(() => {
  if (child && !child.killed) child.kill('SIGTERM');
});

test('health and products endpoints respond', async () => {
  const health = await fetch('http://127.0.0.1:4100/api/health');
  assert.equal(health.status, 200);
  const healthBody = await health.json();
  assert.equal(healthBody.ok, true);

  const products = await fetch('http://127.0.0.1:4100/api/products');
  assert.equal(products.status, 200);
  const productsBody = await products.json();
  assert.ok(Array.isArray(productsBody.products));
  assert.ok(productsBody.products.length > 0);
});
