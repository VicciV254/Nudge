/**
 * calendarSync engine tests against an in-memory Prisma double and a stubbed
 * Google API.
 *
 * This is where the real risk lives: an infinite webhook loop, a lost
 * nextSyncToken, or a silently discarded user edit. All three are covered here.
 */
import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret';
process.env.ENCRYPTION_KEY = '0'.repeat(64);
process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLIENT_ID = 'cid';
process.env.GOOGLE_CLIENT_SECRET = 'sec';
process.env.GOOGLE_REDIRECT_URI = 'https://x.test/cb';

// ---- in-memory stand-ins -------------------------------------------------
const db = { user: null, tasks: new Map() };

const prismaDouble = {
  user: {
    findUnique: async () => db.user,
    findFirst: async () => db.user,
    update: async ({ data }) => {
      for (const [k, v] of Object.entries(data)) db.user[k] = v;
      return db.user;
    },
  },
  task: {
    findFirst: async ({ where }) => db.tasks.get(where.id) ?? null,
    findMany: async () => [...db.tasks.values()],
    update: async ({ where, data }) => {
      const t = db.tasks.get(where.id);
      for (const [k, v] of Object.entries(data)) t[k] = v;
      return t;
    },
    updateMany: async () => ({ count: 0 }),
    count: async () => 0,
  },
};

mock.module('../src/config/db.js', {
  defaultExport: prismaDouble,
  namedExports: { prisma: prismaDouble },
});

// Google API double — each test sets `googleResponses`.
let googleCalls = [];
let listPages = [];
let listPageIndex = 0;
// Mutable hooks — the module double reads these on every call, so a test can
// change behaviour after the import has already been bound.
const hooks = { patchError: null };

const googleDouble = {
  isConfigured: () => true,
  getAccessToken: async () => 'access-token',
  listEvents: async (_u, _c, query) => {
    googleCalls.push({ op: 'list', query });
    const page = listPages[Math.min(listPageIndex, listPages.length - 1)];
    listPageIndex += 1;
    if (page instanceof Error) throw page;
    return page;
  },
  insertEvent: async (_u, _c, body) => {
    googleCalls.push({ op: 'insert', body });
    return { id: 'evt_new', ...body };
  },
  patchEvent: async (_u, _c, id, body) => {
    googleCalls.push({ op: 'patch', id, body });
    // Tests can force a failure here without rebinding the module export.
    if (hooks.patchError) throw hooks.patchError;
    return { id, ...body };
  },
  deleteEvent: async (_u, _c, id) => {
    googleCalls.push({ op: 'delete', id });
    return null;
  },
  watchEvents: async () => ({ resourceId: 'res_1', expiration: String(Date.now() + 6 * 864e5) }),
  stopChannel: async () => null,
  listCalendars: async () => ({ items: [] }),
  GoogleApiError: class extends Error {
    constructor(m, s) {
      super(m);
      this.status = s;
    }
  },
};

mock.module('../src/services/googleClient.js', { namedExports: googleDouble });

const sync = await import('../src/services/calendarSync.js');
const { taskToEvent } = await import('../src/services/eventMapper.js');

const baseUser = () => ({
  id: 'u1',
  timezone: 'Africa/Nairobi',
  calendarId: 'primary',
  calendarSyncEnabled: true,
  calendarSyncDirection: 'both',
  defaultReminderMinutes: 30,
  syncToken: null,
  channelId: null,
  channelResourceId: null,
});

const baseTask = (over = {}) => ({
  id: 'task_1',
  userId: 'u1',
  title: 'Send Q3 report',
  description: null,
  priority: 'urgent',
  category: 'Work',
  completed: false,
  dueDate: new Date('2026-08-15T10:00:00Z'),
  calendarSync: true,
  calendarEventId: null,
  syncStatus: 'pending',
  syncHash: null,
  revision: 1,
  updatedAt: new Date('2026-08-14T12:00:00Z'),
  ...over,
});

beforeEach(() => {
  db.user = baseUser();
  db.tasks = new Map([['task_1', baseTask()]]);
  googleCalls = [];
  listPages = [];
  listPageIndex = 0;
  hooks.patchError = null;
});

// ---------------------------------------------------------------- push

describe('pushTask', () => {
  test('creates an event and records the hash', async () => {
    const out = await sync.pushTask('u1', 'task_1');
    assert.equal(out.action, 'created');
    const t = db.tasks.get('task_1');
    assert.equal(t.calendarEventId, 'evt_new');
    assert.equal(t.syncStatus, 'synced');
    assert.ok(t.syncHash, 'hash must be stored so the webhook can detect our echo');
  });

  test('patches when an event already exists', async () => {
    db.tasks.get('task_1').calendarEventId = 'evt_existing';
    const out = await sync.pushTask('u1', 'task_1');
    assert.equal(out.action, 'updated');
    assert.equal(googleCalls[0].op, 'patch');
  });

  test('removes the event when the due date is cleared', async () => {
    Object.assign(db.tasks.get('task_1'), { dueDate: null, calendarEventId: 'evt_x' });
    const out = await sync.pushTask('u1', 'task_1');
    assert.equal(out.action, 'removed');
    assert.equal(googleCalls[0].op, 'delete');
    assert.equal(db.tasks.get('task_1').calendarEventId, null);
  });

  test('respects pull-only direction', async () => {
    db.user.calendarSyncDirection = 'pull';
    const out = await sync.pushTask('u1', 'task_1');
    assert.equal(out.skipped, 'pull-only');
    assert.equal(googleCalls.length, 0);
  });

  test('recreates the event if the user deleted it in Google', async () => {
    db.tasks.get('task_1').calendarEventId = 'evt_deleted';
    hooks.patchError = Object.assign(new Error('gone'), { status: 404 });

    const out = await sync.pushTask('u1', 'task_1');
    assert.equal(out.action, 'recreated');
    assert.equal(db.tasks.get('task_1').calendarEventId, 'evt_new');
  });
});

// ---------------------------------------------------------------- pull

describe('pullChanges', () => {
  test('ignores our own write echoing back (the loop guard)', async () => {
    const task = db.tasks.get('task_1');
    const { event, hash } = taskToEvent(task, { timezone: 'Africa/Nairobi' });
    Object.assign(task, { syncHash: hash, syncStatus: 'synced', calendarEventId: 'evt_1' });

    listPages = [{ items: [{ id: 'evt_1', status: 'confirmed', ...event }], nextSyncToken: 'tok_1' }];

    const stats = await sync.pullChanges('u1');
    assert.equal(stats.ignored, 1, 'an unchanged echo must not be re-applied');
    assert.equal(stats.updated ?? 0, 0);
  });

  test('applies a genuine remote edit', async () => {
    const task = db.tasks.get('task_1');
    const { event, hash } = taskToEvent(task, { timezone: 'Africa/Nairobi' });
    Object.assign(task, { syncHash: hash, syncStatus: 'synced', calendarEventId: 'evt_1' });

    listPages = [
      {
        items: [
          {
            id: 'evt_1',
            status: 'confirmed',
            summary: 'Send Q3 report (moved)',
            start: { dateTime: '2026-08-16T14:00:00Z' },
            end: { dateTime: '2026-08-16T15:00:00Z' },
            extendedProperties: { private: { source: 'nudge', taskId: 'task_1' } },
          },
        ],
        nextSyncToken: 'tok_2',
      },
    ];

    const stats = await sync.pullChanges('u1');
    assert.equal(stats.updated, 1);
    assert.equal(db.tasks.get('task_1').title, 'Send Q3 report (moved)');
    assert.equal(db.user.syncToken, 'tok_2');
  });

  test('cancelled events unlink the task without deleting it', async () => {
    Object.assign(db.tasks.get('task_1'), { calendarEventId: 'evt_1', syncStatus: 'synced' });
    listPages = [
      {
        items: [
          { id: 'evt_1', status: 'cancelled', extendedProperties: { private: { source: 'nudge', taskId: 'task_1' } } },
        ],
        nextSyncToken: 'tok_3',
      },
    ];
    const stats = await sync.pullChanges('u1');
    assert.equal(stats.deleted, 1);
    const t = db.tasks.get('task_1');
    assert.ok(t, 'the task itself must survive');
    assert.equal(t.calendarEventId, null);
    assert.equal(t.syncStatus, 'off');
  });

  test("ignores events this app did not create", async () => {
    listPages = [
      { items: [{ id: 'meeting_1', status: 'confirmed', summary: "Someone else's meeting" }], nextSyncToken: 't' },
    ];
    const stats = await sync.pullChanges('u1');
    assert.equal(stats.ignored, 1);
  });

  test('follows pagination and only stores the token from the FINAL page', async () => {
    listPages = [
      { items: [], nextPageToken: 'p2' },
      { items: [], nextPageToken: 'p3' },
      { items: [], nextSyncToken: 'final_token' },
    ];
    await sync.pullChanges('u1');
    assert.equal(googleCalls.length, 3, 'must exhaust every page');
    assert.equal(db.user.syncToken, 'final_token');
  });

  test('recovers from a 410 by discarding the token and re-syncing fully', async () => {
    db.user.syncToken = 'stale_token';
    const gone = Object.assign(new Error('Sync token expired'), { status: 410 });
    listPages = [gone, { items: [], nextSyncToken: 'fresh_token' }];

    const stats = await sync.pullChanges('u1');
    assert.ok(stats, 'must not throw on 410');
    assert.equal(db.user.syncToken, 'fresh_token');

    // The retry must be a FULL sync — no syncToken, and a bounded time window.
    const retry = googleCalls[1].query;
    assert.equal(retry.syncToken, undefined);
    assert.ok(retry.timeMin, 'full resync should bound the window');
  });

  test('never sends syncToken together with timeMin (Google returns 400)', async () => {
    db.user.syncToken = 'tok';
    listPages = [{ items: [], nextSyncToken: 'tok2' }];
    await sync.pullChanges('u1');
    const q = googleCalls[0].query;
    assert.ok(q.syncToken);
    assert.equal(q.timeMin, undefined);
    assert.equal(q.timeMax, undefined);
  });

  test('flags a conflict when both sides changed, and records the losing value', async () => {
    const task = db.tasks.get('task_1');
    Object.assign(task, {
      syncStatus: 'pending', // local edit not yet pushed
      calendarEventId: 'evt_1',
      syncHash: 'something-else',
      updatedAt: new Date('2026-08-14T12:00:00Z'),
    });

    listPages = [
      {
        items: [
          {
            id: 'evt_1',
            status: 'confirmed',
            summary: 'Changed in Google',
            updated: '2026-08-14T13:00:00Z', // newer than local
            start: { dateTime: '2026-08-16T09:00:00Z' },
            extendedProperties: { private: { source: 'nudge', taskId: 'task_1' } },
          },
        ],
        nextSyncToken: 'tok',
      },
    ];

    const stats = await sync.pullChanges('u1');
    assert.equal(stats.conflicts, 1);

    const t = db.tasks.get('task_1');
    assert.equal(t.syncStatus, 'conflict');
    assert.ok(t.conflictData, 'the user must be able to see what was overwritten');
    assert.equal(t.conflictData.winner, 'google');
    assert.equal(t.conflictData.nudge.title, 'Send Q3 report');
    assert.equal(t.conflictData.google.title, 'Changed in Google');
  });

  test("a failed push ('error') is treated as dirty, not overwritten", async () => {
    // Regression: only 'pending' used to count as dirty, so a task whose push
    // had failed would be silently clobbered by the next pull.
    const task = db.tasks.get('task_1');
    Object.assign(task, {
      syncStatus: 'error',
      calendarEventId: 'evt_1',
      syncHash: 'stale',
      updatedAt: new Date('2026-08-14T12:00:00Z'),
    });

    listPages = [
      {
        items: [
          {
            id: 'evt_1',
            status: 'confirmed',
            summary: 'Changed in Google',
            updated: '2026-08-14T13:00:00Z',
            extendedProperties: { private: { source: 'nudge', taskId: 'task_1' } },
          },
        ],
        nextSyncToken: 'tok',
      },
    ];

    const stats = await sync.pullChanges('u1');
    assert.equal(stats.conflicts, 1, 'should raise a conflict rather than overwrite');
    assert.ok(db.tasks.get('task_1').conflictData);
  });

  test('an unresolved conflict is not clobbered by a later pull', async () => {
    const task = db.tasks.get('task_1');
    Object.assign(task, {
      syncStatus: 'conflict',
      calendarEventId: 'evt_1',
      syncHash: 'stale',
      updatedAt: new Date('2026-08-14T12:00:00Z'),
    });

    listPages = [
      {
        items: [
          {
            id: 'evt_1',
            status: 'confirmed',
            summary: 'Changed again',
            updated: '2026-08-14T14:00:00Z',
            extendedProperties: { private: { source: 'nudge', taskId: 'task_1' } },
          },
        ],
        nextSyncToken: 'tok',
      },
    ];

    const stats = await sync.pullChanges('u1');
    assert.equal(stats.conflicts, 1);
    assert.equal(db.tasks.get('task_1').syncStatus, 'conflict');
  });

  test('respects push-only direction', async () => {
    db.user.calendarSyncDirection = 'push';
    const out = await sync.pullChanges('u1');
    assert.equal(out.skipped, 'push-only');
    assert.equal(googleCalls.length, 0);
  });
});

// ---------------------------------------------------------------- watch

describe('watch channels', () => {
  test('skips opening a channel without an HTTPS webhook (localhost dev)', async () => {
    delete process.env.GOOGLE_WEBHOOK_URL;
    const out = await sync.startWatch('u1');
    assert.equal(out.skipped, 'no-https-webhook');
  });

  test('opens a channel and stores the verification token', async () => {
    process.env.GOOGLE_WEBHOOK_URL = 'https://api.nudge.test/api/calendar/webhook';
    const out = await sync.startWatch('u1');
    assert.ok(out.channelId);
    assert.ok(db.user.channelToken, 'token is required to verify inbound webhooks');
    assert.equal(db.user.channelResourceId, 'res_1');
    delete process.env.GOOGLE_WEBHOOK_URL;
  });
});
