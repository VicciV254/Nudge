/**
 * Client-side recurrence helpers.
 *
 * Only presentation and preset handling live here — all authoritative date
 * maths happens on the server, so the two can never disagree.
 */

export const PRESETS = [
  { id: 'none', label: 'Does not repeat', rrule: null },
  { id: 'daily', label: 'Every day', rrule: 'FREQ=DAILY' },
  { id: 'weekdays', label: 'Every weekday', rrule: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR' },
  { id: 'weekly', label: 'Every week', rrule: 'FREQ=WEEKLY' },
  { id: 'biweekly', label: 'Every 2 weeks', rrule: 'FREQ=WEEKLY;INTERVAL=2' },
  { id: 'monthly', label: 'Every month', rrule: 'FREQ=MONTHLY' },
  { id: 'yearly', label: 'Every year', rrule: 'FREQ=YEARLY' },
];

const DAY_NAMES = {
  SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday',
  TH: 'Thursday', FR: 'Friday', SA: 'Saturday',
};

const ordinal = (n) => {
  if (n < 0) return 'last day';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const list = (arr) =>
  arr.length === 1 ? arr[0] : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;

function parse(rrule) {
  if (!rrule) return null;
  const out = {};
  for (const part of rrule.replace(/^RRULE:/i, '').split(';')) {
    const [k, v] = part.split('=');
    if (k && v) out[k.trim().toUpperCase()] = v.trim();
  }
  return out.FREQ ? out : null;
}

/** Plain-English label for a rule. Mirrors the server's describeRRule. */
export function describeRecurrence(rrule, dueDate = null) {
  const r = parse(rrule);
  if (!r) return null;

  const interval = Number(r.INTERVAL || 1);
  const days = r.BYDAY ? r.BYDAY.split(',').map((d) => d.trim().toUpperCase()) : [];
  let base;

  switch (r.FREQ.toUpperCase()) {
    case 'DAILY': {
      const plain = days.map((d) => d.slice(-2));
      const isWeekdays =
        plain.length === 5 && ['MO', 'TU', 'WE', 'TH', 'FR'].every((d) => plain.includes(d));
      if (isWeekdays) base = 'Every weekday';
      else if (plain.length) base = `Every ${list(plain.map((d) => DAY_NAMES[d]))}`;
      else base = interval === 1 ? 'Every day' : `Every ${interval} days`;
      break;
    }
    case 'WEEKLY': {
      const every = interval === 1 ? 'Every week' : `Every ${interval} weeks`;
      const names = days.map((d) => DAY_NAMES[d.slice(-2)]).filter(Boolean);
      base = names.length ? `${every} on ${list(names)}` : every;
      break;
    }
    case 'MONTHLY': {
      const every = interval === 1 ? 'Every month' : `Every ${interval} months`;
      if (r.BYMONTHDAY) base = `${every} on the ${ordinal(Number(r.BYMONTHDAY.split(',')[0]))}`;
      else if (dueDate) base = `${every} on the ${ordinal(new Date(dueDate).getDate())}`;
      else base = every;
      break;
    }
    case 'YEARLY':
      base = interval === 1 ? 'Every year' : `Every ${interval} years`;
      break;
    default:
      return rrule;
  }

  if (r.COUNT) base += `, ${r.COUNT} times`;
  return base;
}

/** Which preset a rule corresponds to, or 'custom'. */
export function presetIdFor(rrule) {
  if (!rrule) return 'none';
  const found = PRESETS.find((p) => p.rrule === rrule);
  return found ? found.id : 'custom';
}
