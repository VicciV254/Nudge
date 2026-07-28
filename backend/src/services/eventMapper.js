/**
 * Task <-> Google Calendar event transforms.
 *
 * All the brand/API decisions that matter live here, in one place.
 */
import { payloadHash } from '../utils/crypto.js';

/**
 * Google's events.colorId is a fixed 11-slot palette; arbitrary hex is rejected.
 * These slots were solved for MUTUAL SEPARATION (all >= dE 0.13 in OKLab) rather
 * than nearest-match, because what matters is that a user scanning a month view
 * in Google can tell the priorities apart.
 *
 * Two corrections against the obvious mapping:
 *   "3" is Grape (PURPLE), not green — a very common bug that renders every
 *       completed task purple. Green is "10" (Basil).
 *   high uses "5" (Banana) not "6" (Tangerine): Tangerine is a red-orange only
 *       dE 0.07 from urgent's Tomato, indistinguishable at chip size.
 */
export const COLOR_ID = {
  urgent: '11', // Tomato
  high: '5',    // Banana
  normal: '8',  // Graphite
  low: '9',     // Blueberry
  completed: '10', // Basil
};

export const DEFAULT_DURATION_MIN = 60;

const iso = (d) => new Date(d).toISOString();

/**
 * Build the Google event body for a task.
 *
 * Deliberately NO emoji prefix on `summary`: it breaks alphabetical sort in
 * Google's agenda view, renders as tofu on some Android builds, and duplicates
 * information colorId already carries.
 */
export function taskToEvent(task, { timezone = 'UTC', reminderMinutes = 30, appUrl = '', recurrence = null } = {}) {
  const start = new Date(task.dueDate);
  const end = new Date(start.getTime() + DEFAULT_DURATION_MIN * 60_000);

  const lines = [];
  if (task.description) lines.push(task.description, '');
  lines.push(`Priority: ${task.priority}`);
  if (task.category) lines.push(`Category: ${task.category}`);
  if (appUrl) lines.push('', `Open in Nudge: ${appUrl}/app/tasks?task=${task.id}`);

  const event = {
    summary: task.title,
    description: lines.join('\n'),
    start: { dateTime: iso(start), timeZone: timezone },
    end: { dateTime: iso(end), timeZone: timezone },
    colorId: task.completed ? COLOR_ID.completed : COLOR_ID[task.priority] || COLOR_ID.normal,
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: reminderMinutes }],
    },
    // Private extended properties are invisible to the user but round-trip
    // through Google, which is how we re-associate an event with its task
    // without keeping a second lookup table.
    extendedProperties: {
      private: {
        taskId: task.id,
        source: 'nudge',
        priority: task.priority,
        revision: String(task.revision ?? 1),
        ...(task.seriesId ? { seriesId: task.seriesId } : {}),
      },
    },
  };

  // A recurring task becomes ONE recurring Google event, not N copies. Google
  // expands the RRULE itself, so the user's calendar shows the whole series
  // even though we only materialise one instance at a time.
  if (recurrence) event.recurrence = [`RRULE:${recurrence.replace(/^RRULE:/i, '')}`];

  // The hash covers only the fields WE own. If a webhook comes back and the
  // recomputed hash matches what we stored, the change was our own write
  // echoing back — ignore it. Without this, two-way sync loops forever.
  const hash = payloadHash({
    summary: event.summary,
    description: event.description,
    start: event.start.dateTime,
    end: event.end.dateTime,
    colorId: event.colorId,
    recurrence: event.recurrence?.[0] || null,
  });

  event.extendedProperties.private.hash = hash;
  return { event, hash };
}

/** Recompute the hash from an event Google handed back to us. */
export function hashOfEvent(ev) {
  return payloadHash({
    summary: ev.summary || '',
    description: ev.description || '',
    start: ev.start?.dateTime || ev.start?.date || '',
    end: ev.end?.dateTime || ev.end?.date || '',
    colorId: ev.colorId || COLOR_ID.normal,
    recurrence: ev.recurrence?.[0] || null,
  });
}

/** Map an inbound Google event onto the task fields we accept from Google. */
export function eventToTaskPatch(ev) {
  const patch = {};
  if (typeof ev.summary === 'string' && ev.summary.trim()) patch.title = ev.summary.trim().slice(0, 200);

  const start = ev.start?.dateTime || ev.start?.date;
  if (start) patch.dueDate = new Date(start);

  // We intentionally do NOT map colorId back to priority. Users recolour events
  // for their own reasons, and silently rewriting priority from a colour change
  // is the kind of surprise that makes people distrust a sync.
  return patch;
}

/** The RRULE on an inbound event, without the "RRULE:" prefix. */
export function recurrenceOfEvent(ev) {
  const line = (ev?.recurrence || []).find((l) => /^RRULE:/i.test(l));
  return line ? line.replace(/^RRULE:/i, '') : null;
}

export const isNudgeEvent = (ev) => ev?.extendedProperties?.private?.source === 'nudge';
export const taskIdOf = (ev) => ev?.extendedProperties?.private?.taskId || null;
