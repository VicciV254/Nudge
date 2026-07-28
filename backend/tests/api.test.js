/**
 * Route-level tests against an in-memory Prisma stub.
 *
 * These exercise the real Express app, real middleware, real validation and
 * real JWT logic — only the database is swapped out. That is where the bugs
 * actually live, and it means the suite runs with no Postgres.
 *
 * Run: npm test
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret';
process.env.ENCRYPTION_KEY = '0'.repeat(64);
process.env.NODE_ENV = 'test';

const { createApp } = await import('../src/app.js');
const app = createApp();

// Boot the app on an ephemeral port and talk to it over real HTTP.
let base;
let server;
before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});
after(() => new Promise((resolve) => server.close(resolve)));

const call = async (path, opts = {}) => {
  const res = await fetch(base + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

describe('health + routing', () => {
  test('health check responds', async () => {
    const { status, body } = await call('/api/health');
    assert.equal(status, 200);
    assert.equal(body.ok, true);
  });

  test('unknown route returns a helpful 404', async () => {
    const { status, body } = await call('/api/nope');
    assert.equal(status, 404);
    assert.match(body.error, /No route for GET/);
  });
});

describe('auth guard', () => {
  test('tasks require a token', async () => {
    const { status, body } = await call('/api/tasks');
    assert.equal(status, 401);
    assert.equal(body.error, 'Sign in to continue');
  });

  test('a malformed token is rejected', async () => {
    const { status, body } = await call('/api/tasks', {
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    assert.equal(status, 401);
    assert.equal(body.code, 'TOKEN_INVALID');
  });
});

describe('validation', () => {
  test('register rejects a weak password with per-field messages', async () => {
    const { status, body } = await call('/api/auth/register', {
      method: 'POST',
      body: { email: 'a@b.co', password: 'short', displayName: 'A' },
    });
    assert.equal(status, 422);
    assert.ok(body.fields.password, 'expected a password field error');
  });

  test('register rejects a bad email', async () => {
    const { status, body } = await call('/api/auth/register', {
      method: 'POST',
      body: { email: 'nope', password: 'Password1', displayName: 'A' },
    });
    assert.equal(status, 422);
    assert.equal(body.fields.email, 'Enter a valid email address');
  });

  test('login requires both fields', async () => {
    const { status, body } = await call('/api/auth/login', { method: 'POST', body: {} });
    assert.equal(status, 422);
    assert.ok(body.fields.email);
  });

  test('refresh without a token is a 400, not a crash', async () => {
    const { status } = await call('/api/auth/refresh', { method: 'POST', body: {} });
    assert.equal(status, 400);
  });
});

describe('security headers', () => {
  test('helmet is applied', async () => {
    const res = await fetch(base + '/api/health');
    assert.ok(res.headers.get('x-content-type-options'), 'expected helmet headers');
  });
});
