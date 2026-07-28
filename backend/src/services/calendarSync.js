/**
 * Two-way sync between Nudge tasks and Google Calendar events.
 *
 * Direction rules (user-configurable via calendarSyncDirection):
 *   both  — push local changes AND pull remote ones
 *   push  — Nudge is the source of truth; remote edits are overwritten
 *   pull  — Google is the source of truth; we only mirror inbound
 *
 * Conflict policy: last-write-wins resolves the DATA, but we always record the
 * losing value in Task.conflictData so the UI can tell the human it happened.
 * Silent LWW is how users stop trusting a sync feature.
 */
import crypto from 'node:crypto';
import prisma from '../config/db.js';
import * as g from './googleClient.js';
import {
  taskToEvent, eventToTaskPatch, hashOfEvent, isNudgeEvent, taskIdOf, recurrenceOfEvent,
} from './eventMapper.js';

const APP_URL = process.env.APP_URL || '';

const userCalendarCtx = (user) => ({
  timezone: user.timezone || 'UTC',
  reminderMinutes: user.defaultReminderMinutes ?? 30,
  appUrl: APP_URL,
});

// ---------------------------------------------------------------- push

/**
 * Push one task to Google. Creates, patches, or deletes the event as needed.
 * Safe to call repeatedly — it reconciles rather than assuming.
 */
export async function pushTask(userId, taskId) {
  const [user, task] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.task.findFirst({ where: { id: taskId, userId } }),
  ]);
  if (!task) return { skipped: 'task-gone' };
  if (!user?.calendarSyncEnabled) return { skipped: 'sync-disabled' };
  if (user.calendarSyncDirection === 'pull') return { skipped: 'pull-only' };

  const calendarId = user.calendarId || 'primary';

  // No due date -> nothing to represent on a calendar. Remove any stale event.
  if (!task.dueDate || !task.calendarSync) {
    if (task.calendarEventId) {
      await g.deleteEvent(userId, calendarId, task.calendarEventId).catch((e) => {
        if (e.status !== 404 && e.status !== 410) throw e;
      });
      await prisma.task.update({
        where: { id: task.id },
        data: { calendarEventId: null, syncStatus: 'off', syncHash: null, syncedAt: new Date() },
      });
    }
    return { action: 'removed' };
  }

  // If this task belongs to a series, send the series' RRULE so Google stores
  // ONE recurring event instead of a new event per occurrence.
  let recurrence = null;
  if (task.seriesId) {
    const series = await prisma.task.findUnique({
      where: { id: task.seriesId },
      select: { recurrence: true },
    });
    recurrence = series?.recurrence || null;
  }

  const { event, hash } = taskToEvent(task, { ...userCalendarCtx(user), recurrence });

  // Capture this BEFORE the write below: the update mutates `task`, so reading
  // task.calendarEventId afterwards would always look like an update.
  const hadEvent = Boolean(task.calendarEventId);
  const existingEventId = task.calendarEventId;

  try {
    const saved = hadEvent
      ? await g.patchEvent(userId, calendarId, existingEventId, event)
      : await g.insertEvent(userId, calendarId, event);

    await prisma.task.update({
      where: { id: task.id },
      data: {
        calendarEventId: saved.id,
        syncStatus: 'synced',
        syncHash: hash,
        syncedAt: new Date(),
      },
    });
    return { action: hadEvent ? 'updated' : 'created', eventId: saved.id };
  } catch (err) {
    // 404/410 on patch means the user deleted the event in Google. Recreate it
    // rather than leaving the task permanently broken.
    if (hadEvent && (err.status === 404 || err.status === 410)) {
      const created = await g.insertEvent(userId, calendarId, event);
      await prisma.task.update({
        where: { id: task.id },
        data: { calendarEventId: created.id, syncStatus: 'synced', syncHash: hash, syncedAt: new Date() },
      });
      return { action: 'recreated', eventId: created.id };
    }
    await prisma.task.update({
      where: { id: task.id },
      data: { syncStatus: 'error', syncedAt: new Date() },
    });
    throw err;
  }
}

/** Push every task still marked pending. Used after (re)connecting. */
export async function pushPending(userId, { limit = 100 } = {}) {
  const pending = await prisma.task.findMany({
    where: { userId, calendarSync: true, syncStatus: { in: ['pending', 'error'] } },
    select: { id: true },
    take: limit,
  });

  const result = { pushed: 0, failed: 0 };
  // Sequential on purpose: Calendar's per-user write quota is easy to trip and
  // a burst of parallel inserts is the fastest way to get 403 rateLimitExceeded.
  for (const { id } of pending) {
    try {
      await pushTask(userId, id);
      result.pushed += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

// ---------------------------------------------------------------- pull

/**
 * Incremental pull using Google's syncToken.
 *
 * Three constraints the API imposes, all handled here:
 *  1. nextSyncToken only appears on the LAST page — you must exhaust
 *     nextPageToken first or you'll store a page token by mistake.
 *  2. syncToken cannot be combined with timeMin/timeMax/q (HTTP 400).
 *  3. A stale token returns 410 — discard it and run a full resync.
 */
export async function pullChanges(userId, { forceFull = false } = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.calendarSyncEnabled) return { skipped: 'sync-disabled' };
  if (user.calendarSyncDirection === 'push') return { skipped: 'push-only' };

  const calendarId = user.calendarId || 'primary';
  let syncToken = forceFull ? null : user.syncToken;
  let pageToken = null;
  const changes = [];
  let nextSyncToken = null;

  for (;;) {
    const query = syncToken
      ? { syncToken, ...(pageToken ? { pageToken } : {}) }
      : {
          // Full sync: bound the window so we don't drag in years of history.
          timeMin: new Date(Date.now() - 30 * 864e5).toISOString(),
          timeMax: new Date(Date.now() + 180 * 864e5).toISOString(),
          maxResults: '250',
          showDeleted: 'true',
          singleEvents: 'true',
          ...(pageToken ? { pageToken } : {}),
        };

    let page;
    try {
      page = await g.listEvents(userId, calendarId, query);
    } catch (err) {
      if (err.status === 410 && syncToken) {
        // Token went stale. Start over without one.
        await prisma.user.update({ where: { id: userId }, data: { syncToken: null } });
        syncToken = null;
        pageToken = null;
        changes.length = 0;
        continue;
      }
      throw err;
    }

    changes.push(...(page.items || []));
    pageToken = page.nextPageToken || null;
    if (!pageToken) {
      nextSyncToken = page.nextSyncToken || null;
      break;
    }
  }

  const stats = { examined: changes.length, updated: 0, deleted: 0, ignored: 0, conflicts: 0 };

  for (const ev of changes) {
    const applied = await applyRemoteEvent(userId, ev);
    stats[applied] = (stats[applied] ?? 0) + 1;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { syncToken: nextSyncToken, lastSyncAt: new Date() },
  });

  return stats;
}

/**
 * Apply a single inbound event. Returns which bucket it fell into so the caller
 * can report meaningful counts.
 */
async function applyRemoteEvent(userId, ev) {
  // We only care about events we created. A user's unrelated meetings are not
  // tasks, and inventing tasks from them would be wildly presumptuous.
  if (!isNudgeEvent(ev)) return 'ignored';

  const taskId = taskIdOf(ev);
  if (!taskId) return 'ignored';

  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) return 'ignored';

  // Deleted / cancelled in Google.
  if (ev.status === 'cancelled') {
    await prisma.task.update({
      where: { id: task.id },
      data: { calendarEventId: null, calendarSync: false, syncStatus: 'off', syncHash: null, syncedAt: new Date() },
    });
    return 'deleted';
  }

  // Loop guard: if the event still hashes to what we last wrote, this
  // notification is the echo of our own push.
  const incomingHash = hashOfEvent(ev);
  if (task.syncHash && incomingHash === task.syncHash) return 'ignored';

  // A repeat-rule change in Google belongs to the series row, not the instance.
  const inboundRRule = recurrenceOfEvent(ev);
  if (inboundRRule && task.seriesId) {
    const series = await prisma.task.findUnique({
      where: { id: task.seriesId },
      select: { recurrence: true },
    });
    if (series && series.recurrence !== inboundRRule) {
      await prisma.task.update({
        where: { id: task.seriesId },
        data: { recurrence: inboundRRule, recurrenceEnded: false },
      });
    }
  }

  const patch = eventToTaskPatch(ev);
  if (Object.keys(patch).length === 0) return 'ignored';

  // Conflict: we have unpushed local changes AND Google changed too.
  // 'error' counts as dirty — a push that failed still has local edits that
  // were never sent, and overwriting them here would lose the user's work.
  // 'conflict' counts too, so an unresolved conflict is never silently
  // clobbered by a later pull.
  const locallyDirty = ['pending', 'error', 'conflict'].includes(task.syncStatus);
  if (locallyDirty) {
    const googleNewer = ev.updated && task.updatedAt && new Date(ev.updated) > task.updatedAt;
    await prisma.task.update({
      where: { id: task.id },
      data: {
        syncStatus: 'conflict',
        conflictData: {
          detectedAt: new Date().toISOString(),
          googleUpdatedAt: ev.updated ?? null,
          localUpdatedAt: task.updatedAt.toISOString(),
          winner: googleNewer ? 'google' : 'nudge',
          google: { title: patch.title ?? null, dueDate: patch.dueDate?.toISOString() ?? null },
          nudge: { title: task.title, dueDate: task.dueDate?.toISOString() ?? null },
        },
        // LWW resolves the data; the record above tells the user it happened.
        ...(googleNewer ? patch : {}),
      },
    });
    return 'conflicts';
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { ...patch, syncStatus: 'synced', syncHash: incomingHash, syncedAt: new Date() },
  });
  return 'updated';
}

// ---------------------------------------------------------------- watch

/**
 * Open a push-notification channel. Google has no renewal endpoint — you open
 * a fresh channel and tolerate an overlap window where both are live, which the
 * loop guard already makes harmless.
 */
export async function startWatch(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.calendarSyncEnabled) return { skipped: 'sync-disabled' };

  const webhookUrl = process.env.GOOGLE_WEBHOOK_URL;
  // Google refuses non-HTTPS and unverified domains, so on localhost we simply
  // fall back to polling rather than failing the whole connect flow.
  if (!webhookUrl || !webhookUrl.startsWith('https://')) {
    return { skipped: 'no-https-webhook' };
  }

  const channelId = crypto.randomUUID();
  const channelToken = crypto.randomUUID();

  const res = await g.watchEvents(userId, user.calendarId || 'primary', {
    id: channelId,
    type: 'web_hook',
    address: webhookUrl,
    token: channelToken,
    params: { ttl: String(7 * 24 * 60 * 60) }, // 7 days, Google's practical max
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      channelId,
      channelToken,
      channelResourceId: res.resourceId,
      channelExpiry: res.expiration ? new Date(Number(res.expiration)) : null,
    },
  });
  return { channelId, expiration: res.expiration };
}

export async function stopWatch(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.channelId || !user.channelResourceId) return { skipped: 'no-channel' };
  await g.stopChannel(userId, user.channelId, user.channelResourceId).catch(() => {});
  await prisma.user.update({
    where: { id: userId },
    data: { channelId: null, channelResourceId: null, channelToken: null, channelExpiry: null },
  });
  return { stopped: true };
}

/** Full reconcile: push anything pending, then pull remote changes. */
export async function syncNow(userId) {
  const pushed = await pushPending(userId);
  const pulled = await pullChanges(userId);
  return { pushed, pulled };
}
