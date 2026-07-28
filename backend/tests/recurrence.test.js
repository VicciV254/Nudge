/**
 * Recurrence service tests against an in-memory Prisma double.
 *
 * Focus: series advance, the reschedule-drift trap, double-advance guards,
 * and scoped edit/delete.
 */
import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret';
process.env.ENCRYPTION_KEY = '0'.repeat(64);
process.env.NODE_ENV = 'test';

// ---- in-memory Prisma double --------------------------------------------
const db = { tasks: new Map(), seq: 0 };
const match = (t, where = {}) =>
  Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && 'not' in v) return t[k] !== v.not;
    return t[k] === v;
  });

const prismaDouble = {
  task: {
    findFirst: async ({ where = {} }) => [...db.tasks.values()].find((t) => match(t, where)) ?? null,
    findUnique: async ({ where }) => db.tasks.get(where.id) ?? null,
    findMany: async ({ where = {}, orderBy } = {}) => {
      let rows = [...db.tasks.values()].filter((t) => match(t, where));
      if (orderBy?.dueDate === 'desc') {
        rows = rows.sort((a, b) => new Date(b.dueDate ?? 0) - new Date(a.dueDate ?? 0));
      }
      return rows;
    },
    create: async ({ data }) => {
      const id = data.id ?? `t${++db.seq}`;
      const row = { id, completed: false, ...data };
      db.tasks.set(id, row);
      return row;
    },
    update: async ({ where, data }) => {
      const t = db.tasks.get(where.id);
      for (const [k, v] of Object.entries(data)) t[k] = v;
      return t;
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const t of db.tasks.values()) {
        if (match(t, where)) {
          Object.assign(t, data);
          count += 1;
        }
      }
      return { count };
    },
    delete: async ({ where }) => {
      const t = db.tasks.get(where.id);
      db.tasks.delete(where.id);
      // Emulate the schema's onDelete: Cascade on the self-relation.
      for (const [id, row] of [...db.tasks]) if (row.seriesId === where.id) db.tasks.delete(id);
      return t;
    },
    deleteMany: async ({ where }) => {
      let count = 0;
      for (const [id, t] of [...db.tasks]) {
        if (match(t, where)) {
          db.tasks.delete(id);
          count += 1;
        }
      }
      return { count };
    },
  },
  $transaction: async (ops) => Promise.all(ops),
};

mock.module('../src/config/db.js', {
  defaultExport: prismaDouble,
  namedExports: { prisma: prismaDouble },
});

const rec = await import('../src/services/recurrence.js');

const mkSeries = (over = {}) => {
  const row = {
    id: 'series_1',
    userId: 'u1',
    title: 'Weekly report',
    description: 'Send it',
    priority: 'normal',
    category: 'Work',
    tags: [],
    calendarSync: false,
    completed: false,
    recurrence: 'FREQ=WEEKLY',
    recurrenceStart: new Date('2026-08-03T09:00:00Z'), // Monday
    recurrenceEnded: false,
    dueDate: new Date('2026-08-03T09:00:00Z'),
    seriesId: null,
    ...over,
  };
  db.tasks.set(row.id, row);
  return row;
};

const mkInstance = (over = {}) => {
  const id = over.id ?? `inst_${++db.seq}`;
  const row = {
    id,
    userId: 'u1',
    title: 'Weekly report',
    priority: 'normal',
    completed: false,
    seriesId: 'series_1',
    recurrence: null,
    dueDate: new Date('2026-08-03T09:00:00Z'),
    calendarSync: false,
    ...over,
  };
  db.tasks.set(id, row);
  return row;
};

beforeEach(() => {
  db.tasks = new Map();
  db.seq = 0;
});

// -------------------------------------------------------------------------

describe('advanceSeries', () => {
  test('completing an instance creates the next one', async () => {
    mkSeries();
    const inst = mkInstance({ completed: true });

    const next = await rec.advanceSeries('u1', inst, 'UTC');
    assert.ok(next, 'a next instance should be created');
    assert.equal(next.dueDate.toISOString(), '2026-08-10T09:00:00.000Z');
    assert.equal(next.seriesId, 'series_1');
    assert.equal(next.completed, false);
  });

  test('copies the template fields onto the new instance', async () => {
    mkSeries({ title: 'Water plants', priority: 'high', category: 'Home' });
    const inst = mkInstance({ completed: true });

    const next = await rec.advanceSeries('u1', inst, 'UTC');
    assert.equal(next.title, 'Water plants');
    assert.equal(next.priority, 'high');
    assert.equal(next.category, 'Home');
  });

  test('a one-off reschedule does NOT drift the series', async () => {
    // This is the bug worth guarding: the user drags Monday's instance to
    // Wednesday. The next occurrence must still be the following MONDAY,
    // not the following Wednesday.
    mkSeries();
    const inst = mkInstance({
      completed: true,
      dueDate: new Date('2026-08-05T09:00:00Z'), // moved to Wednesday
    });

    const next = await rec.advanceSeries('u1', inst, 'UTC');
    assert.equal(
      next.dueDate.toISOString(),
      '2026-08-10T09:00:00.000Z',
      'should snap back to the series anchor weekday (Monday)'
    );
  });

  test('does not create a second open instance (double-click guard)', async () => {
    mkSeries();
    const inst = mkInstance({ id: 'inst_a', completed: true });
    mkInstance({ id: 'inst_b', completed: false }); // already open

    const next = await rec.advanceSeries('u1', inst, 'UTC');
    assert.equal(next, null, 'an open instance already exists');
  });

  test('marks the series ended when COUNT is exhausted', async () => {
    mkSeries({ recurrence: 'FREQ=DAILY;COUNT=2' });
    const inst = mkInstance({
      completed: true,
      dueDate: new Date('2026-08-04T09:00:00Z'), // the 2nd (final) occurrence
    });

    const next = await rec.advanceSeries('u1', inst, 'UTC');
    assert.equal(next, null);
    assert.equal(db.tasks.get('series_1').recurrenceEnded, true);
  });

  test('respects UNTIL', async () => {
    mkSeries({ recurrence: 'FREQ=DAILY;UNTIL=20260804T235959Z' });
    const inst = mkInstance({ completed: true, dueDate: new Date('2026-08-04T09:00:00Z') });

    const next = await rec.advanceSeries('u1', inst, 'UTC');
    assert.equal(next, null);
    assert.equal(db.tasks.get('series_1').recurrenceEnded, true);
  });

  test('a non-recurring task advances nothing', async () => {
    const plain = mkInstance({ seriesId: null, completed: true });
    assert.equal(await rec.advanceSeries('u1', plain, 'UTC'), null);
  });

  test('an ended series does not resurrect', async () => {
    mkSeries({ recurrenceEnded: true });
    const inst = mkInstance({ completed: true });
    assert.equal(await rec.advanceSeries('u1', inst, 'UTC'), null);
  });
});

describe('seedSeries', () => {
  test('a future anchor is used as the first occurrence', async () => {
    const future = new Date(Date.now() + 7 * 864e5);
    future.setUTCHours(9, 0, 0, 0);
    mkSeries({ recurrence: 'FREQ=WEEKLY', recurrenceStart: future, dueDate: future });

    const first = await rec.seedSeries('u1', 'series_1', 'UTC');
    assert.ok(first);
    assert.equal(first.dueDate.getTime(), future.getTime(), 'should not skip the anchor itself');
  });

  test('a past anchor rolls forward instead of creating an overdue task', async () => {
    // Creating "every Monday" with an anchor months ago should produce the
    // NEXT Monday, not a pile of overdue rows.
    const past = new Date(Date.now() - 60 * 864e5);
    mkSeries({ recurrence: 'FREQ=WEEKLY', recurrenceStart: past, dueDate: past });

    const first = await rec.seedSeries('u1', 'series_1', 'UTC');
    assert.ok(first);
    assert.ok(first.dueDate > new Date(), 'first instance must be in the future');
  });

  test('an invalid rule seeds nothing', async () => {
    mkSeries({ recurrence: 'FREQ=NONSENSE' });
    assert.equal(await rec.seedSeries('u1', 'series_1', 'UTC'), null);
  });
});

describe('materialiseDue sweep', () => {
  test('creates an instance for a series that has none open', async () => {
    mkSeries();
    // Simulate the relation shape the sweep selects.
    db.tasks.get('series_1').instances = [];
    db.tasks.get('series_1').user = { timezone: 'UTC' };

    const out = await rec.materialiseDue();
    assert.equal(out.created, 1);
  });

  test('leaves a series that already has an open instance alone', async () => {
    mkSeries();
    db.tasks.get('series_1').instances = [{ id: 'inst_open' }];
    db.tasks.get('series_1').user = { timezone: 'UTC' };

    const out = await rec.materialiseDue();
    assert.equal(out.created, 0);
  });
});

describe('scoped delete', () => {
  test("scope 'this' removes only the instance", async () => {
    mkSeries();
    mkInstance({ id: 'inst_a' });
    mkInstance({ id: 'inst_b' });

    const out = await rec.deleteSeries('u1', 'inst_a', 'this');
    assert.equal(out.deleted, 1);
    assert.ok(db.tasks.has('inst_b'), 'siblings survive');
    assert.ok(db.tasks.has('series_1'), 'the series survives');
  });

  test("scope 'all' removes the series and cascades to instances", async () => {
    mkSeries();
    mkInstance({ id: 'inst_a' });
    mkInstance({ id: 'inst_b', completed: true });

    await rec.deleteSeries('u1', 'inst_a', 'all');
    assert.equal(db.tasks.has('series_1'), false);
    assert.equal(db.tasks.has('inst_a'), false);
    assert.equal(db.tasks.has('inst_b'), false);
  });

  test("scope 'future' keeps completed history and stops the series", async () => {
    mkSeries();
    mkInstance({ id: 'done', completed: true });
    mkInstance({ id: 'open', completed: false });

    await rec.deleteSeries('u1', 'open', 'future');
    assert.ok(db.tasks.has('done'), 'completed history is preserved');
    assert.equal(db.tasks.has('open'), false);
    assert.equal(db.tasks.get('series_1').recurrenceEnded, true);
  });

  test('collects calendar event ids so events are not orphaned', async () => {
    mkSeries();
    mkInstance({ id: 'inst_a', calendarEventId: 'evt_a' });

    const out = await rec.deleteSeries('u1', 'inst_a', 'this');
    assert.deepEqual(out.eventIds, ['evt_a']);
  });
});

describe('scoped update — regression', () => {
  // These pin a bug that shipped once: taskController.update() destructured
  // `scope` out of the body and then ignored it, so "this and future" silently
  // behaved like "just this one".
  test("'future' must not tick off sibling instances", async () => {
    mkSeries({ title: 'Original' });
    mkInstance({ id: 'a', title: 'Original', completed: false });
    mkInstance({ id: 'b', title: 'Original', completed: false });

    // Only content fields may propagate; completion is per-instance.
    await rec.updateSeries('u1', 'a', { title: 'Renamed' }, 'future');
    assert.equal(db.tasks.get('b').title, 'Renamed');
    assert.equal(db.tasks.get('b').completed, false, 'siblings must not be completed');
  });

  test("'future' propagates to the series template as well", async () => {
    mkSeries({ title: 'Original', priority: 'normal' });
    mkInstance({ id: 'a', title: 'Original', priority: 'normal' });

    await rec.updateSeries('u1', 'a', { priority: 'high' }, 'future');
    assert.equal(
      db.tasks.get('series_1').priority,
      'high',
      'future occurrences come from the template, so it must change too'
    );
  });
});

describe('scoped update', () => {
  test("scope 'this' edits only the instance", async () => {
    mkSeries({ title: 'Original' });
    mkInstance({ id: 'inst_a', title: 'Original' });

    await rec.updateSeries('u1', 'inst_a', { title: 'Just this one' }, 'this');
    assert.equal(db.tasks.get('inst_a').title, 'Just this one');
    assert.equal(db.tasks.get('series_1').title, 'Original', 'the template is untouched');
  });

  test("scope 'future' updates the template and open instances only", async () => {
    mkSeries({ title: 'Original' });
    mkInstance({ id: 'done', title: 'Original', completed: true });
    mkInstance({ id: 'open', title: 'Original', completed: false });

    await rec.updateSeries('u1', 'open', { title: 'Renamed' }, 'future');
    assert.equal(db.tasks.get('series_1').title, 'Renamed');
    assert.equal(db.tasks.get('open').title, 'Renamed');
    assert.equal(db.tasks.get('done').title, 'Original', 'history is not rewritten');
  });

  test("scope 'all' rewrites completed instances too", async () => {
    mkSeries({ title: 'Original' });
    mkInstance({ id: 'done', title: 'Original', completed: true });

    await rec.updateSeries('u1', 'done', { title: 'Renamed' }, 'all');
    assert.equal(db.tasks.get('done').title, 'Renamed');
  });
});
