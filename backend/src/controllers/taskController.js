import prisma from '../config/db.js';
import * as sync from '../services/calendarSync.js';
import * as rec from '../services/recurrence.js';
import { parseRRule } from '../utils/rrule.js';

/**
 * Fire-and-forget push to Google.
 *
 * Deliberately not awaited: a slow or failing Calendar API must never make the
 * user's task write feel slow or fail. The task row already records
 * syncStatus='pending', so a later /calendar/sync will retry anything missed.
 */
function schedulePush(userId, taskId) {
  setImmediate(() => {
    sync.pushTask(userId, taskId).catch((err) => {
      console.error('[calendar] push failed for task', taskId, '-', err.message);
    });
  });
}

/** Fields the client is allowed to see. Never leak sync tokens or hashes. */
const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  completed: true,
  priority: true,
  category: true,
  tags: true,
  dueDate: true,
  completedAt: true,
  calendarSync: true,
  calendarEventId: true,
  syncStatus: true,
  syncedAt: true,
  conflictData: true,
  recurrence: true,
  recurrenceStart: true,
  seriesId: true,
  createdAt: true,
  updatedAt: true,
};

function rangeFor(filter, tz = 'UTC') { // eslint-disable-line no-unused-vars
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  switch (filter) {
    case 'today':
      return { completed: false, dueDate: { gte: start, lte: end } };
    case 'upcoming':
      return { completed: false, dueDate: { gt: end } };
    case 'overdue':
      return { completed: false, dueDate: { lt: start } };
    case 'completed':
      return { completed: true };
    default:
      return {};
  }
}

export async function list(req, res) {
  const { filter, search, limit = '200', cursor } = req.query;

  const where = {
    userId: req.user.id,
    // Series rows are templates, not tasks. Only their materialised instances
    // (and ordinary non-recurring tasks) belong in the list.
    recurrence: null,
    ...rangeFor(filter),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const take = Math.min(Number(limit) || 200, 500);
  const tasks = await prisma.task.findMany({
    where,
    select: TASK_SELECT,
    orderBy: [{ completed: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  res.json(tasks);
}

export async function getOne(req, res) {
  const task = await prisma.task.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: TASK_SELECT,
  });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
}

export async function create(req, res) {
  const { calendarSync, dueDate, recurrence, ...rest } = req.body;

  // Reject a malformed RRULE up front rather than storing a rule that will
  // silently never fire.
  if (recurrence && !parseRRule(recurrence)) {
    return res.status(422).json({
      error: 'Some fields need attention',
      fields: { recurrence: 'That repeat rule is not valid' },
    });
  }
  if (recurrence && !dueDate) {
    return res.status(422).json({
      error: 'Some fields need attention',
      fields: { dueDate: 'A repeating task needs a first date' },
    });
  }

  const due = dueDate ? new Date(dueDate) : null;

  // The counter and the row are written together, so tasksCreated can never
  // drift from reality even if the request fails halfway.
  const [task] = await prisma.$transaction([
    prisma.task.create({
      data: {
        ...rest,
        dueDate: due,
        // Calendar sync only makes sense for something with a time on it.
        calendarSync: Boolean(calendarSync && due),
        syncStatus: calendarSync && due && !recurrence ? 'pending' : 'off',
        recurrence: recurrence || null,
        // The anchor fixes the series' time of day; it never moves when an
        // individual instance is rescheduled.
        recurrenceStart: recurrence ? due : null,
        userId: req.user.id,
      },
      select: TASK_SELECT,
    }),
    prisma.user.update({
      where: { id: req.user.id },
      data: { tasksCreated: { increment: 1 }, lastActiveAt: new Date() },
    }),
  ]);

  // A recurring task returns its first INSTANCE — the series row itself is a
  // template the user never sees in their list.
  if (recurrence) {
    const first = await rec.seedSeries(req.user.id, task.id, req.user.timezone || 'UTC');
    if (first?.calendarSync) schedulePush(req.user.id, first.id);
    const shaped = first
      ? await prisma.task.findUnique({ where: { id: first.id }, select: TASK_SELECT })
      : task;
    return res.status(201).json(shaped);
  }

  if (task.calendarSync) schedulePush(req.user.id, task.id);
  res.status(201).json(task);
}

export async function update(req, res) {
  const existing = await prisma.task.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true, completed: true, calendarSync: true, seriesId: true },
  });
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const { dueDate, completed, recurrence, scope, ...rest } = req.body;
  const data = { ...rest, revision: { increment: 1 } };

  // Changing the repeat rule targets the SERIES, never the instance row.
  if (recurrence !== undefined) {
    if (recurrence && !parseRRule(recurrence)) {
      return res.status(422).json({
        error: 'Some fields need attention',
        fields: { recurrence: 'That repeat rule is not valid' },
      });
    }
    const seriesId = existing.seriesId || existing.id;
    await prisma.task.update({
      where: { id: seriesId },
      data: { recurrence: recurrence || null, recurrenceEnded: false },
    });
  }

  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (completed !== undefined) {
    data.completed = completed;
    data.completedAt = completed ? new Date() : null;
  }
  // Any content change needs to be pushed to Google again.
  if (existing.calendarSync) data.syncStatus = 'pending';

  const justCompleted = completed === true && !existing.completed;
  const justReopened = completed === false && existing.completed;

  // Scoped edit of a recurring series ('future' / 'all'). Applied before the
  // instance write so the template and its siblings move together; 'this' is
  // the default and needs no special handling.
  if (scope && scope !== 'this' && existing.seriesId) {
    // Only propagate content fields — completion and dates stay per-instance,
    // otherwise "rename this and future" would also tick off every sibling.
    const { completed: _c, dueDate: _d, syncStatus: _s, revision: _r, ...shared } = data;
    if (Object.keys(shared).length) {
      await rec.updateSeries(req.user.id, existing.id, shared, scope);
    }
  }

  const ops = [
    prisma.task.update({ where: { id: existing.id }, data, select: TASK_SELECT }),
  ];
  if (justCompleted || justReopened) {
    ops.push(
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          tasksCompleted: { increment: justCompleted ? 1 : -1 },
          lastActiveAt: new Date(),
        },
      })
    );
  }

  const [task] = await prisma.$transaction(ops);

  // Completing an instance materialises the next occurrence. Done after the
  // transaction so a recurrence bug can never roll back the user's completion.
  let nextInstance = null;
  if (justCompleted && existing.seriesId) {
    try {
      nextInstance = await rec.advanceSeries(req.user.id, task, req.user.timezone || 'UTC');
      if (nextInstance?.calendarSync) schedulePush(req.user.id, nextInstance.id);
    } catch (err) {
      console.error('[recurrence] advance failed for', task.id, '-', err.message);
    }
  }

  // Push when the task is (or just stopped being) calendar-linked, so turning
  // sync off also removes the event rather than orphaning it.
  if (task.calendarSync || existing.calendarSync) schedulePush(req.user.id, task.id);

  res.json(nextInstance ? { ...task, nextInstance: shapeTask(nextInstance) } : task);
}

/** Trim a raw row down to the client-visible shape. */
function shapeTask(t) {
  const out = {};
  for (const k of Object.keys(TASK_SELECT)) out[k] = t[k];
  return out;
}

export async function remove(req, res) {
  // ?scope=this|future|all — how much of a recurring series to remove.
  const scope = ['this', 'future', 'all'].includes(req.query.scope) ? req.query.scope : 'this';

  // Collect event ids BEFORE deleting, otherwise the Google events are orphaned
  // in the user's calendar with no way to find them again.
  const result = await rec.deleteSeries(req.user.id, req.params.id, scope);
  if (result.deleted === 0) return res.status(404).json({ error: 'Task not found' });

  if (result.eventIds?.length) {
    setImmediate(async () => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { calendarId: true, calendarSyncEnabled: true },
        });
        if (!user?.calendarSyncEnabled) return;
        const g = await import('../services/googleClient.js');
        for (const eventId of result.eventIds) {
          await g
            .deleteEvent(req.user.id, user.calendarId || 'primary', eventId)
            .catch((err) => {
              if (err.status !== 404 && err.status !== 410) throw err;
            });
        }
      } catch (err) {
        console.error('[calendar] event cleanup failed:', err.message);
      }
    });
  }

  res.status(204).end();
}

export async function stats(req, res) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  // One round trip instead of five — matters on a serverless DB where each
  // query pays connection latency.
  const [total, completed, today, overdue, upcoming] = await prisma.$transaction([
    prisma.task.count({ where: { userId: req.user.id } }),
    prisma.task.count({ where: { userId: req.user.id, completed: true } }),
    prisma.task.count({
      where: { userId: req.user.id, completed: false, dueDate: { gte: start, lte: end } },
    }),
    prisma.task.count({
      where: { userId: req.user.id, completed: false, dueDate: { lt: start } },
    }),
    prisma.task.count({
      where: { userId: req.user.id, completed: false, dueDate: { gt: end } },
    }),
  ]);

  res.json({ total, completed, open: total - completed, today, overdue, upcoming });
}
