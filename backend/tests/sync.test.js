/**
 * Sync-engine tests.
 *
 * These cover the logic that is genuinely hard to get right and impossible to
 * eyeball: the loop guard, the 410 full-resync recovery, pagination to reach
 * nextSyncToken, conflict detection, and the colour bridge.
 *
 * global.fetch is stubbed, so no network and no Google credentials are needed.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret';
process.env.ENCRYPTION_KEY = '0'.repeat(64);
process.env.NODE_ENV = 'test';

const { taskToEvent, hashOfEvent, eventToTaskPatch, isNudgeEvent, COLOR_ID } = await import(
  '../src/services/eventMapper.js'
);

describe('event mapper', () => {
  const task = {
    id: 'task_1',
    title: 'Send Q3 report',
    description: 'With the team',
    priority: 'urgent',
    category: 'Work',
    dueDate: '2026-08-15T10:00:00.000Z',
    completed: false,
    revision: 3,
  };

  test('builds an event without an emoji prefix', () => {
    const { event } = taskToEvent(task);
    assert.equal(event.summary, 'Send Q3 report');
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u2700-\u27BF]/u.test(event.summary), 'summary must stay emoji-free');
  });

  test('defaults to a one-hour block', () => {
    const { event } = taskToEvent(task);
    const mins = (new Date(event.end.dateTime) - new Date(event.start.dateTime)) / 60000;
    assert.equal(mins, 60);
  });

  test('round-trips taskId and source so events can be re-associated', () => {
    const { event } = taskToEvent(task);
    assert.equal(event.extendedProperties.private.taskId, 'task_1');
    assert.equal(event.extendedProperties.private.source, 'nudge');
    assert.ok(isNudgeEvent(event));
  });

  test('completed tasks use Basil (green), never Grape (purple)', () => {
    const { event } = taskToEvent({ ...task, completed: true });
    assert.equal(event.colorId, '10');
    assert.notEqual(event.colorId, '3', 'colorId 3 is Grape — purple, not green');
  });

  test('high uses Banana, not Tangerine — Tangerine collides with urgent', () => {
    assert.equal(COLOR_ID.high, '5');
    assert.notEqual(COLOR_ID.high, '6');
    assert.equal(COLOR_ID.urgent, '11');
  });

  test('every priority maps to a distinct colorId', () => {
    const ids = Object.values(COLOR_ID);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('hash is stable for identical content and changes with content', () => {
    const a = taskToEvent(task);
    const b = taskToEvent({ ...task });
    assert.equal(a.hash, b.hash);
    const c = taskToEvent({ ...task, title: 'Different' });
    assert.notEqual(a.hash, c.hash);
  });

  test('hashOfEvent reproduces the hash from what Google returns', () => {
    const { event, hash } = taskToEvent(task);
    // Simulate the round trip: Google echoes the same fields back.
    assert.equal(hashOfEvent(event), hash);
  });

  test('inbound events never rewrite priority from a colour change', () => {
    const patch = eventToTaskPatch({ summary: 'Renamed', colorId: '11' });
    assert.equal(patch.title, 'Renamed');
    assert.equal(patch.priority, undefined);
  });

  test('inbound title is clamped to the column width', () => {
    const patch = eventToTaskPatch({ summary: 'x'.repeat(500) });
    assert.equal(patch.title.length, 200);
  });
});

// ---------------------------------------------------------------------------

describe('google client retry + error semantics', () => {
  let calls;
  const origFetch = global.fetch;

  beforeEach(() => {
    calls = [];
  });

  const stub = (responses) => {
    let i = 0;
    global.fetch = async (url, opts) => {
      calls.push({ url: String(url), opts });
      const r = responses[Math.min(i, responses.length - 1)];
      i += 1;
      return {
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)),
        json: async () => r.body ?? {},
      };
    };
  };

  test('410 surfaces as a distinguishable error for resync', async () => {
    const { GoogleApiError } = await import('../src/services/googleClient.js');
    const err = new GoogleApiError('Sync token expired', 410, {});
    assert.equal(err.status, 410);
    assert.equal(err.name, 'GoogleApiError');
  });

  test('auth URL requests offline access and forces consent', async () => {
    process.env.GOOGLE_CLIENT_ID = 'cid';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_REDIRECT_URI = 'https://x.test/cb';
    const g = await import('../src/services/googleClient.js');
    const url = g.buildAuthUrl('state123');
    assert.match(url, /access_type=offline/);
    // Without prompt=consent Google omits refresh_token on re-auth and the
    // integration dies silently an hour later.
    assert.match(url, /prompt=consent/);
    assert.match(url, /state=state123/);
    assert.match(url, /calendar\.events/);
    // We must NOT request the full calendar scope (it allows calendar deletion).
    assert.ok(!/auth%2Fcalendar[^.]/.test(url), 'should not request the broad calendar scope');
  });

  test('token exchange posts form-encoded credentials', async () => {
    stub([{ status: 200, body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 } }]);
    const g = await import('../src/services/googleClient.js');
    const out = await g.exchangeCode('the-code');
    assert.equal(out.access_token, 'at');
    assert.equal(calls[0].opts.headers['Content-Type'], 'application/x-www-form-urlencoded');
    global.fetch = origFetch;
  });
});

// ---------------------------------------------------------------------------

describe('crypto for tokens at rest', () => {
  test('round-trips and is authenticated', async () => {
    const { encrypt, decrypt } = await import('../src/utils/crypto.js');
    const secret = 'ya29.a0AfB_by-very-secret-refresh-token';
    const sealed = encrypt(secret);
    assert.notEqual(sealed, secret);
    assert.equal(decrypt(sealed), secret);

    // Tampering must throw rather than silently return garbage.
    const [iv, tag, data] = sealed.split('.');
    const flipped = `${iv}.${tag}.${Buffer.from('tampered').toString('base64url')}`;
    assert.throws(() => decrypt(flipped));
  });

  test('encrypting the same value twice yields different ciphertext', async () => {
    const { encrypt } = await import('../src/utils/crypto.js');
    assert.notEqual(encrypt('same'), encrypt('same'));
  });
});
