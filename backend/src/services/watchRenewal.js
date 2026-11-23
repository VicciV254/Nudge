// Google push channels expire and can't be renewed, so this reopens them before webhooks quietly
// stop. pollStaleAccounts covers accounts whose webhook never fires.
import prisma from '../config/db.js';
import * as sync from './calendarSync.js';
import { materialiseDue } from './recurrence.js';

const HOUR = 60 * 60 * 1000;

export async function renewExpiringWatches({ withinMs = 24 * HOUR } = {}) {
  const due = await prisma.user.findMany({
    where: {
      calendarSyncEnabled: true,
      googleRefreshToken: { not: null },
      OR: [
        { channelExpiry: { lt: new Date(Date.now() + withinMs) } },
        { channelExpiry: null },
      ],
    },
    select: { id: true },
    take: 200,
  });

  let renewed = 0;
  for (const { id } of due) {
    try {
      await sync.stopWatch(id);
      const res = await sync.startWatch(id);
      if (!res.skipped) renewed += 1;
    } catch (err) {
      console.error('[calendar] watch renewal failed for', id, '-', err.message);
    }
  }
  return { considered: due.length, renewed };
}

export async function pollStaleAccounts({ olderThanMs = 6 * HOUR } = {}) {
  const stale = await prisma.user.findMany({
    where: {
      calendarSyncEnabled: true,
      googleRefreshToken: { not: null },
      OR: [{ lastSyncAt: { lt: new Date(Date.now() - olderThanMs) } }, { lastSyncAt: null }],
    },
    select: { id: true },
    take: 100,
  });

  let synced = 0;
  for (const { id } of stale) {
    try {
      await sync.syncNow(id);
      synced += 1;
    } catch (err) {
      console.error('[calendar] poll failed for', id, '-', err.message);
    }
  }
  return { considered: stale.length, synced };
}

// Every process that calls this runs the jobs; set DISABLE_CALENDAR_JOBS=true on extra instances.
export function startScheduler() {
  if (process.env.DISABLE_CALENDAR_JOBS === 'true') return null;
  const timer = setInterval(() => {
    renewExpiringWatches().catch(() => {});
    pollStaleAccounts().catch(() => {});
    // Safety net: re-materialise instances for any series left without one
    // (e.g. the user deleted the open instance outright).
    materialiseDue().catch(() => {});
  }, HOUR);
  timer.unref?.();
  return timer;
}
