/**
 * RRULE engine tests.
 *
 * Heavy on the cases that break naive implementations: DST boundaries,
 * month-end clamping, leap years, and COUNT/UNTIL termination.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const {
  parseRRule,
  formatRRule,
  nextOccurrence,
  expand,
  describeRRule,
  partsInZone,
  zonedTimeToUtc,
} = await import('../src/utils/rrule.js');

const at = (s) => new Date(s);
const local = (d, tz) => {
  const p = partsInZone(d, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
};

describe('parsing', () => {
  test('parses a simple rule', () => {
    const r = parseRRule('FREQ=WEEKLY;BYDAY=MO,WE;INTERVAL=2');
    assert.equal(r.freq, 'WEEKLY');
    assert.equal(r.interval, 2);
    assert.deepEqual(r.byDay, ['MO', 'WE']);
  });

  test('tolerates the RRULE: prefix and lowercase', () => {
    const r = parseRRule('rrule:freq=daily;interval=3');
    assert.equal(r.freq, 'DAILY');
    assert.equal(r.interval, 3);
  });

  test('returns null for junk rather than throwing', () => {
    // A malformed rule from Google must degrade to "not recurring", never 500.
    for (const bad of ['', null, undefined, 'nonsense', 'FREQ=HOURLY', 'INTERVAL=2']) {
      assert.equal(parseRRule(bad), null, `expected null for ${JSON.stringify(bad)}`);
    }
  });

  test('ignores invalid components but keeps the valid ones', () => {
    const r = parseRRule('FREQ=MONTHLY;INTERVAL=0;BYMONTHDAY=45,15;COUNT=-3');
    assert.equal(r.interval, 1, 'interval 0 is invalid -> default 1');
    assert.deepEqual(r.byMonthDay, [15], 'day 45 is dropped');
    assert.equal(r.count, undefined);
  });

  test('COUNT and UNTIL are mutually exclusive (RFC 5545)', () => {
    const r = parseRRule('FREQ=DAILY;COUNT=5;UNTIL=20261231T000000Z');
    assert.equal(r.count, 5);
    assert.equal(r.until, undefined);
  });

  test('round-trips through formatRRule', () => {
    const src = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR;COUNT=10';
    assert.equal(formatRRule(parseRRule(src)), src);
  });
});

describe('daily', () => {
  test('steps one day at a time', () => {
    const r = parseRRule('FREQ=DAILY');
    const start = at('2026-08-03T09:00:00Z');
    const next = nextOccurrence(r, start, start, 'UTC');
    assert.equal(next.toISOString(), '2026-08-04T09:00:00.000Z');
  });

  test('honours INTERVAL', () => {
    const r = parseRRule('FREQ=DAILY;INTERVAL=3');
    const start = at('2026-08-03T09:00:00Z');
    const got = expand(r, start, { limit: 3 }).map((d) => d.toISOString().slice(0, 10));
    assert.deepEqual(got, ['2026-08-03', '2026-08-06', '2026-08-09']);
  });

  test('BYDAY filters to weekdays and skips the weekend', () => {
    const r = parseRRule('FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR');
    // 2026-08-07 is a Friday.
    const start = at('2026-08-07T09:00:00Z');
    const next = nextOccurrence(r, start, start, 'UTC');
    assert.equal(next.toISOString().slice(0, 10), '2026-08-10', 'Friday -> Monday');
  });
});

describe('weekly', () => {
  test('without BYDAY it repeats on the start weekday', () => {
    const r = parseRRule('FREQ=WEEKLY');
    const start = at('2026-08-05T14:00:00Z'); // Wednesday
    const next = nextOccurrence(r, start, start, 'UTC');
    assert.equal(next.toISOString(), '2026-08-12T14:00:00.000Z');
  });

  test('BYDAY with several days fires on each', () => {
    const r = parseRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR');
    const start = at('2026-08-03T09:00:00Z'); // Monday
    const got = expand(r, start, { limit: 4 }).map((d) => d.toISOString().slice(0, 10));
    assert.deepEqual(got, ['2026-08-03', '2026-08-05', '2026-08-07', '2026-08-10']);
  });

  test('INTERVAL=2 skips a week', () => {
    const r = parseRRule('FREQ=WEEKLY;INTERVAL=2');
    const start = at('2026-08-05T09:00:00Z');
    const got = expand(r, start, { limit: 3 }).map((d) => d.toISOString().slice(0, 10));
    assert.deepEqual(got, ['2026-08-05', '2026-08-19', '2026-09-02']);
  });
});

describe('monthly', () => {
  test('repeats on the same day number', () => {
    const r = parseRRule('FREQ=MONTHLY');
    const start = at('2026-08-15T09:00:00Z');
    const got = expand(r, start, { limit: 3 }).map((d) => d.toISOString().slice(0, 10));
    assert.deepEqual(got, ['2026-08-15', '2026-09-15', '2026-10-15']);
  });

  test('the 31st clamps to shorter months instead of vanishing', () => {
    const r = parseRRule('FREQ=MONTHLY');
    const start = at('2026-01-31T09:00:00Z');
    const got = expand(r, start, { limit: 4 }).map((d) => d.toISOString().slice(0, 10));
    // Feb 2026 has 28 days: clamp, don't roll into March 3rd.
    assert.deepEqual(got, ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  test('nth weekday: second Tuesday', () => {
    const r = parseRRule('FREQ=MONTHLY;BYDAY=2TU');
    const start = at('2026-08-01T09:00:00Z');
    const got = expand(r, start, { limit: 3 }).map((d) => d.toISOString().slice(0, 10));
    assert.deepEqual(got, ['2026-08-11', '2026-09-08', '2026-10-13']);
  });

  test('last Friday of the month', () => {
    const r = parseRRule('FREQ=MONTHLY;BYDAY=-1FR');
    const start = at('2026-08-01T09:00:00Z');
    const got = expand(r, start, { limit: 3 }).map((d) => d.toISOString().slice(0, 10));
    assert.deepEqual(got, ['2026-08-28', '2026-09-25', '2026-10-30']);
  });
});

describe('yearly + leap years', () => {
  test('repeats annually', () => {
    const r = parseRRule('FREQ=YEARLY');
    const start = at('2026-03-01T09:00:00Z');
    const got = expand(r, start, { limit: 3 }).map((d) => d.toISOString().slice(0, 10));
    assert.deepEqual(got, ['2026-03-01', '2027-03-01', '2028-03-01']);
  });

  test('29 February clamps to the 28th in non-leap years', () => {
    const r = parseRRule('FREQ=YEARLY');
    const start = at('2028-02-29T09:00:00Z'); // 2028 is a leap year
    const got = expand(r, start, { limit: 3 }).map((d) => d.toISOString().slice(0, 10));
    assert.deepEqual(got, ['2028-02-29', '2029-02-28', '2030-02-28']);
  });
});

describe('DST — the case naive implementations get wrong', () => {
  test('daily 09:00 stays 09:00 across the spring-forward boundary (London)', () => {
    const tz = 'Europe/London';
    const r = parseRRule('FREQ=DAILY');
    // BST begins 2026-03-29. 09:00 GMT before, 09:00 BST after.
    const start = zonedTimeToUtc({ year: 2026, month: 3, day: 27, hour: 9, minute: 0 }, tz);
    const got = expand(r, start, { limit: 4, timeZone: tz }).map((d) => local(d, tz));
    assert.deepEqual(got, [
      '2026-03-27 09:00',
      '2026-03-28 09:00',
      '2026-03-29 09:00', // clocks jumped at 01:00 — 09:00 must hold
      '2026-03-30 09:00',
    ]);
  });

  test('daily 09:00 stays 09:00 across the autumn fall-back (London)', () => {
    const tz = 'Europe/London';
    const r = parseRRule('FREQ=DAILY');
    const start = zonedTimeToUtc({ year: 2026, month: 10, day: 24, hour: 9, minute: 0 }, tz);
    const got = expand(r, start, { limit: 4, timeZone: tz }).map((d) => local(d, tz));
    assert.deepEqual(got, [
      '2026-10-24 09:00',
      '2026-10-25 09:00', // BST ends
      '2026-10-26 09:00',
      '2026-10-27 09:00',
    ]);
  });

  test('the underlying UTC instant does shift by an hour, as it must', () => {
    const tz = 'Europe/London';
    const r = parseRRule('FREQ=DAILY');
    const start = zonedTimeToUtc({ year: 2026, month: 3, day: 28, hour: 9, minute: 0 }, tz);
    const [d1, d2] = expand(r, start, { limit: 2, timeZone: tz });
    assert.equal(d1.toISOString(), '2026-03-28T09:00:00.000Z', 'GMT: 09:00 local == 09:00Z');
    assert.equal(d2.toISOString(), '2026-03-29T08:00:00.000Z', 'BST: 09:00 local == 08:00Z');
  });

  test('weekly recurrence holds its local time across DST (New York)', () => {
    const tz = 'America/New_York';
    const r = parseRRule('FREQ=WEEKLY');
    const start = zonedTimeToUtc({ year: 2026, month: 3, day: 4, hour: 14, minute: 30 }, tz);
    const got = expand(r, start, { limit: 3, timeZone: tz }).map((d) => local(d, tz));
    assert.deepEqual(got, ['2026-03-04 14:30', '2026-03-11 14:30', '2026-03-18 14:30']);
  });

  test('a zone without DST is unaffected (Nairobi)', () => {
    const tz = 'Africa/Nairobi';
    const r = parseRRule('FREQ=DAILY');
    const start = zonedTimeToUtc({ year: 2026, month: 3, day: 28, hour: 9, minute: 0 }, tz);
    const got = expand(r, start, { limit: 3, timeZone: tz }).map((d) => local(d, tz));
    assert.deepEqual(got, ['2026-03-28 09:00', '2026-03-29 09:00', '2026-03-30 09:00']);
  });
});

describe('termination', () => {
  test('COUNT stops the series', () => {
    const r = parseRRule('FREQ=DAILY;COUNT=3');
    const start = at('2026-08-03T09:00:00Z');
    const got = expand(r, start, { limit: 10 });
    assert.equal(got.length, 3);
  });

  test('UNTIL stops the series', () => {
    const r = parseRRule('FREQ=DAILY;UNTIL=20260806T235959Z');
    const start = at('2026-08-03T09:00:00Z');
    const got = expand(r, start, { limit: 10 }).map((d) => d.toISOString().slice(0, 10));
    assert.deepEqual(got, ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06']);
  });

  test('nextOccurrence returns null once exhausted', () => {
    const r = parseRRule('FREQ=DAILY;COUNT=2');
    const start = at('2026-08-03T09:00:00Z');
    assert.equal(nextOccurrence(r, start, at('2026-08-04T09:00:00Z'), 'UTC'), null);
  });
});

describe('descriptions', () => {
  const cases = [
    ['FREQ=DAILY', 'Every day'],
    ['FREQ=DAILY;INTERVAL=2', 'Every 2 days'],
    ['FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR', 'Every weekday'],
    ['FREQ=WEEKLY', 'Every week'],
    ['FREQ=WEEKLY;INTERVAL=2', 'Every 2 weeks'],
    ['FREQ=WEEKLY;BYDAY=MO,FR', 'Every week on Monday and Friday'],
    ['FREQ=MONTHLY;BYMONTHDAY=15', 'Every month on the 15th'],
    ['FREQ=MONTHLY;BYDAY=-1FR', 'Every month on the last Friday'],
    ['FREQ=MONTHLY;BYDAY=2TU', 'Every month on the 2nd Tuesday'],
    ['FREQ=YEARLY', 'Every year'],
    ['FREQ=DAILY;COUNT=5', 'Every day, 5 times'],
  ];
  for (const [rule, expected] of cases) {
    test(`${rule} -> "${expected}"`, () => {
      assert.equal(describeRRule(rule), expected);
    });
  }

  test('unparseable input describes as null', () => {
    assert.equal(describeRRule('garbage'), null);
  });
});
