// A series row holds the RRULE and stays out of the list; each occurrence is a real task row, so it
// can be rescheduled or synced on its own. One open instance per series keeps the list from flooding.
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

// First instance: the anchor if still ahead, else the next occurrence after now, so "every Monday"
// created on a Wednesday doesn't start overdue.
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

// On completion, the next occurrence follows the series anchor, not this instance's due date, so
// rescheduling one occurrence doesn't shift the whole series.
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

// Safety net for a series left with no open instance (say, the user deleted it); startScheduler in
// watchRenewal.js runs it hourly.
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

// scope: 'this' edits one task; 'future' the series and its open instances; 'all' every instance too.
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
