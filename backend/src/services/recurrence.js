/**
 * Recurring tasks.
 *
 * Model: a "series" row holds the RRULE and never appears in the task list.
 * Each due occurrence is materialised as a normal task ("instance") pointing
 * back at the series. Completing an instance materialises the next one.
 *
 * Why materialise instead of computing occurrences on read:
 *   - An instance is a real row, so it can be rescheduled, given notes, or
 *     synced to Google independently — none of which works on a virtual date.
 *   - Completion history stays truthful: you can see you did it 9 weeks running.
 *   - The task list query stays a plain indexed read with no expansion step.
 *
 * The cost is a sweep to keep instances materialised, which is what
 * `materialiseDue` does. Only ONE unfinished instance exists per series at a
 * time, so an unused series can't flood the list with a year of rows.
 */
import prisma from '../config/db.js';
import { parseRRule, nextOccurrence, describeRRule } from '../utils/rrule.js';

/** Fields copied from the series onto each instance. */
const TEMPLATE_FIELDS = ['title', 'description', 'priority', 'category', 'tags', 'calendarSync'];

function templateFrom(series) {
  const out = {};
  for (const f of TEMPLATE_FIELDS) out[f] = series[f];
  return out;
}

/**
 * Compute the next due date for a series after a given point.
 * Returns null when the rule is exhausted.
 */
export function nextDueFor(series, after, timeZone = 'UTC') {
  const rule = parseRRule(series.recurrence);
  if (!rule) return null;
  const anchor = series.recurrenceStart || series.dueDate;
  if (!anchor) return null;
  return nextOccurrence(rule, anchor, after, timeZone);
}

/**
 * Create the first instance for a brand-new series.
 * The first occurrence is the anchor itself if it is still in the future,
 * otherwise the next one after now — so creating "every Monday" on a Wednesday
 * doesn't immediately produce an overdue task.
 */
export async function seedSeries(userId, seriesId, timeZone = 'UTC') {
  const series = await prisma.task.findFirst({ where: { id: seriesId, userId } });
  if (!series?.recurrence) return null;

  const rule = parseRRule(series.recurrence);
  if (!rule) return null;

  const anchor = series.recurrenceStart || series.dueDate;
  if (!anchor) return null;

  const now = new Date();
  // `nextOccurrence` is exclusive, so step back 1ms to allow the anchor itself.
  const first =
    anchor > now
      ? nextOccurrence(rule, anchor, new Date(anchor.getTime() - 1), timeZone)
      : nextOccurrence(rule, anchor, now, timeZone);

  if (!first) {
    await prisma.task.update({ where: { id: series.id }, data: { recurrenceEnded: true } });
    return null;
  }

  return prisma.task.create({
    data: {
      ...templateFrom(series),
      dueDate: first,
      userId,
      seriesId: series.id,
      syncStatus: series.calendarSync ? 'pending' : 'off',
    },
  });
}

/**
 * Called when an instance is completed. Materialises the next occurrence.
 *
 * Uses the SERIES anchor rather than the completed instance's due date, so a
 * one-off reschedule ("move this Monday's to Tuesday") doesn't permanently
 * shift the whole series — a genuinely annoying bug in several popular apps.
 */
export async function advanceSeries(userId, completedTask, timeZone = 'UTC') {
  if (!completedTask.seriesId) return null;

  const series = await prisma.task.findFirst({
    where: { id: completedTask.seriesId, userId },
  });
  if (!series?.recurrence || series.recurrenceEnded) return null;

  // Step from the occurrence this instance represents, not from "now".
  const from = completedTask.dueDate || new Date();
  const next = nextDueFor(series, from, timeZone);

  if (!next) {
    await prisma.task.update({ where: { id: series.id }, data: { recurrenceEnded: true } });
    return null;
  }

  // Guard against double-advance: if an open instance already exists for this
  // series (double-click, retried request), don't create a second one.
  const existing = await prisma.task.findFirst({
    where: { seriesId: series.id, completed: false, id: { not: completedTask.id } },
    select: { id: true },
  });
  if (existing) return null;

  return prisma.task.create({
    data: {
      ...templateFrom(series),
      dueDate: next,
      userId,
      seriesId: series.id,
      syncStatus: series.calendarSync ? 'pending' : 'off',
    },
  });
}

/**
 * Safety-net sweep: materialise instances for any series that has none open.
 *
 * Needed because a user can delete an instance outright, or a series can be
 * created while its first occurrence is far in the future. Runs hourly
 * alongside the calendar jobs.
 */
export async function materialiseDue({ limit = 200 } = {}) {
  const series = await prisma.task.findMany({
    where: { recurrence: { not: null }, recurrenceEnded: false, seriesId: null },
    select: {
      id: true,
      userId: true,
      recurrence: true,
      recurrenceStart: true,
      dueDate: true,
      title: true,
      description: true,
      priority: true,
      category: true,
      tags: true,
      calendarSync: true,
      user: { select: { timezone: true } },
      instances: { where: { completed: false }, select: { id: true }, take: 1 },
    },
    take: limit,
  });

  let created = 0;
  let ended = 0;

  for (const s of series) {
    if (s.instances.length > 0) continue; // one open instance at a time

    const tz = s.user?.timezone || 'UTC';
    // Resume from the latest instance we ever made, so we don't re-create
    // occurrences the user already completed.
    const last = await prisma.task.findFirst({
      where: { seriesId: s.id },
      orderBy: { dueDate: 'desc' },
      select: { dueDate: true },
    });

    const from = last?.dueDate || new Date(Date.now() - 1);
    const next = nextDueFor(s, from, tz);

    if (!next) {
      await prisma.task.update({ where: { id: s.id }, data: { recurrenceEnded: true } });
      ended += 1;
      continue;
    }

    await prisma.task.create({
      data: {
        ...templateFrom(s),
        dueDate: next,
        userId: s.userId,
        seriesId: s.id,
        syncStatus: s.calendarSync ? 'pending' : 'off',
      },
    });
    created += 1;
  }

  return { considered: series.length, created, ended };
}

/**
 * Editing a series. `scope` decides how far the change reaches:
 *   'this'   — only the given instance (a one-off tweak)
 *   'future' — the series template and the open instance
 *   'all'    — the series and every instance, including completed ones
 */
export async function updateSeries(userId, taskId, updates, scope = 'this') {
  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) return null;

  const seriesId = task.seriesId || (task.recurrence ? task.id : null);
  if (!seriesId || scope === 'this') {
    return prisma.task.update({ where: { id: task.id }, data: updates });
  }

  const ops = [prisma.task.update({ where: { id: seriesId }, data: updates })];

  if (scope === 'future') {
    ops.push(
      prisma.task.updateMany({
        where: { seriesId, completed: false },
        data: updates,
      })
    );
  } else if (scope === 'all') {
    ops.push(prisma.task.updateMany({ where: { seriesId }, data: updates }));
  }

  await prisma.$transaction(ops);
  return prisma.task.findUnique({ where: { id: task.id } });
}

/**
 * Deleting. Removing a series cascades to its instances (schema-level), so
 * this only needs to decide *what* to delete.
 */
export async function deleteSeries(userId, taskId, scope = 'this') {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true, seriesId: true, recurrence: true, calendarEventId: true },
  });
  if (!task) return { deleted: 0 };

  if (scope === 'this' || (!task.seriesId && !task.recurrence)) {
    await prisma.task.delete({ where: { id: task.id } });
    return { deleted: 1, eventIds: task.calendarEventId ? [task.calendarEventId] : [] };
  }

  const seriesId = task.seriesId || task.id;

  // Collect event ids before deleting so the calendar cleanup can run.
  const doomed = await prisma.task.findMany({
    where: scope === 'future' ? { seriesId, completed: false } : { OR: [{ id: seriesId }, { seriesId }] },
    select: { id: true, calendarEventId: true },
  });
  const eventIds = doomed.map((t) => t.calendarEventId).filter(Boolean);

  if (scope === 'future') {
    await prisma.task.deleteMany({ where: { seriesId, completed: false } });
    await prisma.task.update({ where: { id: seriesId }, data: { recurrenceEnded: true } });
  } else {
    await prisma.task.delete({ where: { id: seriesId } }); // cascades
  }

  return { deleted: doomed.length, eventIds };
}

export { describeRRule };
