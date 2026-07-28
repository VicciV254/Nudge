/**
 * A focused RFC 5545 RRULE implementation.
 *
 * Why not the `rrule` npm package: it is ~50KB, its timezone story relies on a
 * bundled tz database that drifts from the platform's, and we only need four
 * frequencies. This handles exactly what a to-do app generates, and it does the
 * one thing generic libraries usually get wrong for our case — *wall-clock*
 * recurrence across DST.
 *
 * The DST rule that matters: "every weekday at 09:00" must stay 09:00 local
 * after the clocks change. Naive UTC arithmetic (add 24h) silently shifts it to
 * 08:00 or 10:00 for half the year. So all stepping happens on calendar fields
 * in the user's zone, and only the final instant is converted back to UTC.
 */

export const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const FREQS = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);

// ---------------------------------------------------------------- tz helpers

/** Decompose an instant into calendar fields as seen in `timeZone`. */
export function partsInZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const out = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = p.value;
  }
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    // Intl renders midnight as "24" in some locales/zones; normalise it.
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: out.weekday.slice(0, 2).toUpperCase(),
  };
}

/** Offset of `timeZone` at a given instant, in minutes east of UTC. */
function offsetMinutes(date, timeZone) {
  const p = partsInZone(date, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

/**
 * Convert wall-clock fields in `timeZone` to a UTC instant.
 *
 * Two passes: guess using the offset at the naive instant, then correct using
 * the offset actually in force at that guess. This resolves the case where the
 * target time sits on the far side of a DST transition from the guess.
 */
export function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  let ts = naive - offsetMinutes(new Date(naive), timeZone) * 60000;
  ts = naive - offsetMinutes(new Date(ts), timeZone) * 60000;

  // Spring-forward gap: 02:30 simply does not exist. RFC 5545 says to skip
  // such instances; we clamp forward to the first valid moment instead, which
  // is what every calendar UI actually does.
  const check = partsInZone(new Date(ts), timeZone);
  if (check.hour !== hour % 24) {
    const forward = new Date(ts + 60 * 60000);
    const fp = partsInZone(forward, timeZone);
    if (fp.day === day) return forward;
  }
  return new Date(ts);
}

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// ---------------------------------------------------------------- parse

/**
 * Parse an RRULE string. Accepts an optional "RRULE:" prefix.
 * Returns null for anything unusable rather than throwing — a malformed rule
 * from Google should degrade to "not recurring", never 500 the request.
 */
export function parseRRule(input) {
  if (!input || typeof input !== 'string') return null;
  const body = input.replace(/^RRULE:/i, '').trim();
  if (!body) return null;

  const rule = {};
  for (const chunk of body.split(';')) {
    const [rawKey, rawVal] = chunk.split('=');
    if (!rawKey || rawVal === undefined) continue;
    const key = rawKey.trim().toUpperCase();
    const val = rawVal.trim();

    switch (key) {
      case 'FREQ':
        rule.freq = val.toUpperCase();
        break;
      case 'INTERVAL': {
        const n = Number(val);
        if (Number.isInteger(n) && n > 0) rule.interval = n;
        break;
      }
      case 'COUNT': {
        const n = Number(val);
        if (Number.isInteger(n) && n > 0) rule.count = n;
        break;
      }
      case 'UNTIL':
        rule.until = parseUntil(val);
        break;
      case 'BYDAY':
        rule.byDay = val
          .split(',')
          .map((d) => d.trim().toUpperCase())
          .filter((d) => WEEKDAYS.includes(d.slice(-2)));
        break;
      case 'BYMONTHDAY': {
        const days = val
          .split(',')
          .map((d) => Number(d.trim()))
          .filter((d) => Number.isInteger(d) && d >= 1 && d <= 31);
        if (days.length) rule.byMonthDay = days;
        break;
      }
      case 'BYMONTH': {
        const months = val
          .split(',')
          .map((m) => Number(m.trim()))
          .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
        if (months.length) rule.byMonth = months;
        break;
      }
      case 'WKST':
        rule.wkst = val.toUpperCase();
        break;
      default:
        break; // ignore extensions we don't support
    }
  }

  if (!FREQS.has(rule.freq)) return null;
  rule.interval ??= 1;
  // COUNT and UNTIL are mutually exclusive per RFC 5545; COUNT wins.
  if (rule.count && rule.until) delete rule.until;
  return rule;
}

function parseUntil(val) {
  // Basic form: 20261231T235959Z  (or date-only 20261231)
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(val);
  if (!m) return null;
  const [, y, mo, d, h = '23', mi = '59', s = '59'] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

/** Serialise back to an RRULE string (no prefix). */
export function formatRRule(rule) {
  if (!rule?.freq) return null;
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval && rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.byDay?.length) parts.push(`BYDAY=${rule.byDay.join(',')}`);
  if (rule.byMonthDay?.length) parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  if (rule.byMonth?.length) parts.push(`BYMONTH=${rule.byMonth.join(',')}`);
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  else if (rule.until) parts.push(`UNTIL=${toUntilString(rule.until)}`);
  return parts.join(';');
}

const pad = (n) => String(n).padStart(2, '0');
export const toUntilString = (d) => {
  const x = new Date(d);
  return (
    `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}` +
    `T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}Z`
  );
};

// ---------------------------------------------------------------- iterate

/**
 * The next occurrence strictly after `after`.
 *
 * `dtStart` anchors the series: its wall-clock time of day is preserved, and
 * for WEEKLY rules without BYDAY its weekday is implied.
 * Returns null when the series has ended (COUNT exhausted or past UNTIL).
 */
export function nextOccurrence(rule, dtStart, after, timeZone = 'UTC') {
  if (!rule?.freq) return null;

  const start = new Date(dtStart);
  const cursorAfter = new Date(after);
  if (Number.isNaN(start.getTime()) || Number.isNaN(cursorAfter.getTime())) return null;

  const anchor = partsInZone(start, timeZone);
  const time = { hour: anchor.hour, minute: anchor.minute, second: anchor.second };

  // A bounded walk. The cap is generous enough for "every 12 months on the 29th
  // of February" yet still guarantees termination on a pathological rule.
  const MAX_STEPS = 2000;
  let emitted = 0;
  let candidate = null;
  let probe = new Date(start);

  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (rule.count && emitted >= rule.count) return null;
    if (rule.until && probe > rule.until) return null;

    if (matchesRule(rule, probe, anchor, timeZone)) {
      emitted += 1;
      if (probe > cursorAfter) {
        candidate = probe;
        break;
      }
    }

    probe = advance(rule, probe, anchor, time, timeZone);
    if (!probe) return null;
  }

  if (!candidate) return null;
  if (rule.until && candidate > rule.until) return null;
  return candidate;
}

/** Expand up to `limit` occurrences — used for previews in the UI. */
export function expand(rule, dtStart, { limit = 10, timeZone = 'UTC', from } = {}) {
  const out = [];
  let cursor = from ? new Date(from) : new Date(new Date(dtStart).getTime() - 1);
  for (let i = 0; i < limit; i += 1) {
    const next = nextOccurrence(rule, dtStart, cursor, timeZone);
    if (!next) break;
    out.push(next);
    cursor = next;
  }
  return out;
}

function matchesRule(rule, date, anchor, timeZone) {
  const p = partsInZone(date, timeZone);

  if (rule.byMonth && !rule.byMonth.includes(p.month)) return false;

  switch (rule.freq) {
    case 'DAILY':
      // BYDAY on a DAILY rule acts as a filter ("every weekday").
      if (rule.byDay?.length && !rule.byDay.some((d) => d.slice(-2) === p.weekday)) return false;
      return true;

    case 'WEEKLY':
      if (rule.byDay?.length) return rule.byDay.some((d) => d.slice(-2) === p.weekday);
      return p.weekday === anchor.weekday;

    case 'MONTHLY': {
      if (rule.byDay?.length) return matchesNthWeekday(rule.byDay, p, timeZone, date);
      const wanted = rule.byMonthDay?.length ? rule.byMonthDay : [anchor.day];
      const dim = daysInMonth(p.year, p.month);
      // A -1 means "last day"; a day beyond the month's length clamps to it,
      // so "the 31st" still fires in February rather than being skipped.
      return wanted.some((d) => (d < 0 ? dim + d + 1 === p.day : Math.min(d, dim) === p.day));
    }

    case 'YEARLY': {
      const monthOk = rule.byMonth ? rule.byMonth.includes(p.month) : p.month === anchor.month;
      const dim = daysInMonth(p.year, p.month);
      const wantDay = rule.byMonthDay?.length ? rule.byMonthDay[0] : anchor.day;
      return monthOk && Math.min(wantDay, dim) === p.day;
    }

    default:
      return false;
  }
}

/** Handle BYDAY values with an ordinal prefix, e.g. "2TU" or "-1FR". */
function matchesNthWeekday(byDay, p, timeZone, date) {
  return byDay.some((token) => {
    const wd = token.slice(-2);
    if (wd !== p.weekday) return false;
    const ord = parseInt(token.slice(0, -2), 10);
    if (!ord) return true; // plain "TU" -> every Tuesday in the month

    const dim = daysInMonth(p.year, p.month);
    if (ord > 0) {
      const nth = Math.ceil(p.day / 7);
      return nth === ord;
    }
    const fromEnd = Math.ceil((dim - p.day + 1) / 7);
    return fromEnd === -ord;
  });
}

/**
 * Step the probe forward. Stepping happens on wall-clock calendar fields, then
 * converts back — this is what keeps 09:00 at 09:00 across a DST boundary.
 */
function advance(rule, date, anchor, time, timeZone) {
  const p = partsInZone(date, timeZone);

  switch (rule.freq) {
    case 'DAILY':
      return shiftDays(p, rule.byDay?.length ? 1 : rule.interval, time, timeZone);

    case 'WEEKLY':
      // With BYDAY we walk day by day and let matchesRule filter; the interval
      // is enforced by week-number arithmetic below.
      if (rule.byDay?.length) {
        const next = shiftDays(p, 1, time, timeZone);
        if (rule.interval > 1) {
          const weeksApart = Math.floor((next - startOfWeek(anchor, timeZone)) / (7 * 864e5));
          if (weeksApart % rule.interval !== 0) {
            const np = partsInZone(next, timeZone);
            if (np.weekday === (rule.wkst || 'MO')) {
              return shiftDays(np, 7 * (rule.interval - 1), time, timeZone);
            }
          }
        }
        return next;
      }
      return shiftDays(p, 7 * rule.interval, time, timeZone);

    case 'MONTHLY':
      if (rule.byDay?.length) return shiftDays(p, 1, time, timeZone);
      return shiftMonths(p, rule.interval, anchor, time, timeZone);

    case 'YEARLY':
      return shiftMonths(p, 12 * rule.interval, anchor, time, timeZone);

    default:
      return null;
  }
}

function shiftDays(p, n, time, timeZone) {
  const base = Date.UTC(p.year, p.month - 1, p.day) + n * 864e5;
  const d = new Date(base);
  return zonedTimeToUtc(
    { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), ...time },
    timeZone
  );
}

function shiftMonths(p, n, anchor, time, timeZone) {
  const totalMonths = (p.year * 12 + (p.month - 1)) + n;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  // Clamp to the month length so "the 31st" lands on the 28th/30th rather than
  // rolling into the next month.
  const day = Math.min(anchor.day, daysInMonth(year, month));
  return zonedTimeToUtc({ year, month, day, ...time }, timeZone);
}

function startOfWeek(anchor, timeZone) {
  const idx = WEEKDAYS.indexOf(anchor.weekday);
  const base = Date.UTC(anchor.year, anchor.month - 1, anchor.day);
  const monOffset = (idx + 6) % 7;
  return zonedTimeToUtc(
    (() => {
      const d = new Date(base - monOffset * 864e5);
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
    })(),
    timeZone
  );
}

// ---------------------------------------------------------------- presets

/** The handful of patterns a to-do app actually needs, as UI-ready presets. */
export const PRESETS = [
  { id: 'daily', label: 'Every day', rrule: 'FREQ=DAILY' },
  { id: 'weekdays', label: 'Every weekday', rrule: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR' },
  { id: 'weekly', label: 'Every week', rrule: 'FREQ=WEEKLY' },
  { id: 'biweekly', label: 'Every 2 weeks', rrule: 'FREQ=WEEKLY;INTERVAL=2' },
  { id: 'monthly', label: 'Every month', rrule: 'FREQ=MONTHLY' },
  { id: 'yearly', label: 'Every year', rrule: 'FREQ=YEARLY' },
];

/** Plain-English summary for the UI. Falls back to the raw rule if exotic. */
export function describeRRule(input, timeZone = 'UTC', dtStart = null) {
  const rule = parseRRule(input);
  if (!rule) return null;

  const dayNames = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };
  const list = (arr) =>
    arr.length === 1 ? arr[0] : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;

  const i = rule.interval || 1;
  let base;

  switch (rule.freq) {
    case 'DAILY': {
      const days = rule.byDay?.map((d) => d.slice(-2)) || [];
      const isWeekdays = days.length === 5 && ['MO', 'TU', 'WE', 'TH', 'FR'].every((d) => days.includes(d));
      if (isWeekdays) base = 'Every weekday';
      else if (days.length) base = `Every ${list(days.map((d) => dayNames[d]))}`;
      else base = i === 1 ? 'Every day' : `Every ${i} days`;
      break;
    }
    case 'WEEKLY': {
      const days = rule.byDay?.map((d) => dayNames[d.slice(-2)]) || [];
      const every = i === 1 ? 'Every week' : `Every ${i} weeks`;
      base = days.length ? `${every} on ${list(days)}` : every;
      break;
    }
    case 'MONTHLY': {
      const every = i === 1 ? 'Every month' : `Every ${i} months`;
      if (rule.byMonthDay?.length) base = `${every} on the ${ordinal(rule.byMonthDay[0])}`;
      else if (rule.byDay?.length) base = `${every} on the ${nthLabel(rule.byDay[0], dayNames)}`;
      else if (dtStart) base = `${every} on the ${ordinal(partsInZone(new Date(dtStart), timeZone).day)}`;
      else base = every;
      break;
    }
    case 'YEARLY':
      base = i === 1 ? 'Every year' : `Every ${i} years`;
      break;
    default:
      return input;
  }

  if (rule.count) base += `, ${rule.count} times`;
  else if (rule.until) {
    base += `, until ${rule.until.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone })}`;
  }
  return base;
}

function ordinal(n) {
  if (n < 0) return 'last day';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function nthLabel(token, dayNames) {
  const wd = dayNames[token.slice(-2)];
  const ord = parseInt(token.slice(0, -2), 10);
  if (!ord) return wd;
  if (ord === -1) return `last ${wd}`;
  return `${ordinal(ord)} ${wd}`;
}
