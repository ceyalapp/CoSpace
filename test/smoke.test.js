// Smoke tests — no DB required. Exercise health, security headers, and auth gating.
// Run: npm test  (uses Node's built-in test runner)
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../server');

let server, base;

before(async () => {
  await new Promise(resolve => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server?.close(); });

test('GET /api/health returns ok', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.strictEqual(r.status, 200);
  const body = await r.json();
  assert.strictEqual(body.ok, true);
});

test('index sets a Content-Security-Policy header', async () => {
  const r = await fetch(`${base}/`);
  assert.strictEqual(r.status, 200);
  const csp = r.headers.get('content-security-policy');
  assert.ok(csp && csp.includes("script-src 'self'"), 'CSP should pin script-src to self');
});

test('GET /api/me without a token is 401', async () => {
  const r = await fetch(`${base}/api/me`);
  assert.strictEqual(r.status, 401);
});

test('POST /api/me/checklist without a token is 401', async () => {
  const r = await fetch(`${base}/api/me/checklist`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"text":"x"}',
  });
  assert.strictEqual(r.status, 401);
});

test('POST /api/admin/reset is gated (403 without ADMIN_TOKEN)', async () => {
  const r = await fetch(`${base}/api/admin/reset`, { method: 'POST' });
  assert.strictEqual(r.status, 403);
});

test('unknown /api route is 404 JSON', async () => {
  const r = await fetch(`${base}/api/does-not-exist`);
  assert.strictEqual(r.status, 404);
  const body = await r.json();
  assert.ok(body.error);
});
