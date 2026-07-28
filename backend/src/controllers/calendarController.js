import crypto from 'node:crypto';
import prisma from '../config/db.js';
import * as g from '../services/googleClient.js';
import * as sync from '../services/calendarSync.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { signAccess, verifyAccess } from '../utils/jwt.js';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

/**
 * The OAuth `state` parameter is a short-lived JWT carrying the user id plus a
 * random nonce. This is what stops an attacker completing the flow against
 * someone else's account (CSRF) — a bare user id in `state` would be forgeable.
 */
function makeState(userId) {
  return signAccess({ id: `oauth:${userId}:${crypto.randomBytes(8).toString('hex')}`, email: 'oauth' });
}

function readState(state) {
  const payload = verifyAccess(state); // throws if tampered or expired
  const [kind, userId] = String(payload.sub).split(':');
  if (kind !== 'oauth' || !userId) throw new Error('Bad state');
  return userId;
}

/** GET /api/calendar/status */
export async function status(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      calendarSyncEnabled: true,
      calendarId: true,
      calendarSyncDirection: true,
      defaultReminderMinutes: true,
      googleRefreshToken: true,
      lastSyncAt: true,
      channelExpiry: true,
    },
  });

  const [pending, errored, conflicts] = await Promise.all([
    prisma.task.count({ where: { userId: req.user.id, syncStatus: 'pending' } }),
    prisma.task.count({ where: { userId: req.user.id, syncStatus: 'error' } }),
    prisma.task.count({ where: { userId: req.user.id, syncStatus: 'conflict' } }),
  ]);

  res.json({
    configured: g.isConfigured(),
    connected: Boolean(user?.googleRefreshToken),
    enabled: user?.calendarSyncEnabled ?? false,
    calendarId: user?.calendarId ?? 'primary',
    direction: user?.calendarSyncDirection ?? 'both',
    reminderMinutes: user?.defaultReminderMinutes ?? 30,
    lastSyncAt: user?.lastSyncAt ?? null,
    watchExpiresAt: user?.channelExpiry ?? null,
    counts: { pending, errored, conflicts },
  });
}

/** GET /api/calendar/connect  -> redirects to Google consent */
export async function connect(req, res) {
  if (!g.isConfigured()) {
    return res.status(503).json({ error: 'Google Calendar is not configured on this server' });
  }
  res.json({ url: g.buildAuthUrl(makeState(req.user.id)) });
}

/** GET /api/auth/google/callback  -> Google redirects the BROWSER here */
export async function callback(req, res) {
  const { code, state, error } = req.query;
  const back = (params) => res.redirect(`${APP_URL}/app/settings?${new URLSearchParams(params)}`);

  if (error) return back({ calendar: 'denied' });
  if (!code || !state) return back({ calendar: 'invalid' });

  let userId;
  try {
    userId = readState(state);
  } catch {
    return back({ calendar: 'expired' });
  }

  try {
    const tokens = await g.exchangeCode(code);
    if (!tokens.refresh_token) {
      // Without a refresh token the integration dies in an hour. Better to fail
      // loudly now than to look connected and quietly stop working.
      return back({ calendar: 'no_refresh_token' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: encrypt(tokens.access_token),
        googleRefreshToken: encrypt(tokens.refresh_token),
        googleTokenExpiry: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
        calendarSyncEnabled: true,
        syncToken: null, // force a full baseline sync on first pull
      },
    });

    // Best-effort: neither should block the redirect.
    await sync.startWatch(userId).catch(() => {});
    await sync.syncNow(userId).catch(() => {});

    return back({ calendar: 'connected' });
  } catch (err) {
    console.error('[calendar] oauth callback failed:', err.message);
    return back({ calendar: 'failed' });
  }
}

/** POST /api/calendar/disconnect */
export async function disconnect(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { googleRefreshToken: true },
  });

  await sync.stopWatch(req.user.id).catch(() => {});
  if (user?.googleRefreshToken) {
    await g.revokeToken(decrypt(user.googleRefreshToken));
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
      calendarSyncEnabled: false,
      syncToken: null,
      lastSyncAt: null,
    },
  });

  // Tasks keep their data; they just stop syncing.
  await prisma.task.updateMany({
    where: { userId: req.user.id, calendarSync: true },
    data: { calendarSync: false, syncStatus: 'off', calendarEventId: null, syncHash: null },
  });

  res.json({ disconnected: true });
}

/** GET /api/calendar/calendars */
export async function calendars(req, res) {
  const data = await g.listCalendars(req.user.id);
  res.json(
    (data.items || []).map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: Boolean(c.primary),
      backgroundColor: c.backgroundColor,
    }))
  );
}

/** PATCH /api/calendar/settings */
export async function updateSettings(req, res) {
  const { calendarId, direction, reminderMinutes, enabled } = req.body;
  const data = {};
  if (calendarId !== undefined) data.calendarId = calendarId;
  if (direction !== undefined) data.calendarSyncDirection = direction;
  if (reminderMinutes !== undefined) data.defaultReminderMinutes = reminderMinutes;
  if (enabled !== undefined) data.calendarSyncEnabled = enabled;

  // Changing the target calendar invalidates the cursor and the watch channel.
  if (calendarId !== undefined) {
    data.syncToken = null;
    await sync.stopWatch(req.user.id).catch(() => {});
  }

  await prisma.user.update({ where: { id: req.user.id }, data });
  if (calendarId !== undefined) await sync.startWatch(req.user.id).catch(() => {});

  res.json({ saved: true });
}

/** POST /api/calendar/sync */
export async function syncNow(req, res) {
  const result = await sync.syncNow(req.user.id);
  res.json(result);
}

/** POST /api/calendar/tasks/:id/push */
export async function pushOne(req, res) {
  const result = await sync.pushTask(req.user.id, req.params.id);
  res.json(result);
}

/** POST /api/calendar/tasks/:id/resolve  { keep: 'google' | 'nudge' } */
export async function resolveConflict(req, res) {
  const { keep } = req.body;
  const task = await prisma.task.findFirst({ where: { id: req.params.id, userId: req.user.id } });
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.syncStatus !== 'conflict') return res.status(409).json({ error: 'That task is not in conflict' });

  if (keep === 'google') {
    const data = task.conflictData?.google || {};
    await prisma.task.update({
      where: { id: task.id },
      data: {
        ...(data.title ? { title: data.title } : {}),
        ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {}),
        syncStatus: 'synced',
        conflictData: null,
        syncedAt: new Date(),
      },
    });
  } else {
    // Keep ours and overwrite Google on the next push.
    await prisma.task.update({
      where: { id: task.id },
      data: { syncStatus: 'pending', conflictData: null },
    });
    await sync.pushTask(req.user.id, task.id).catch(() => {});
  }

  res.json({ resolved: true, kept: keep });
}

/**
 * POST /api/calendar/webhook  — Google's push notification.
 *
 * Google sends headers only, never a payload, so this is purely a trigger to
 * run an incremental pull. It must return fast: Google retries on timeout and
 * a slow handler turns into duplicate syncs.
 */
export async function webhook(req, res) {
  const channelId = req.get('X-Goog-Channel-ID');
  const token = req.get('X-Goog-Channel-Token');
  const state = req.get('X-Goog-Resource-State');

  // Acknowledge immediately, then work. Google does not read the body.
  res.status(200).end();

  if (state === 'sync') return; // channel handshake, nothing changed yet
  if (!channelId) return;

  const user = await prisma.user.findFirst({
    where: { channelId },
    select: { id: true, channelToken: true },
  });
  // Verify the token so an attacker who guesses a channel id can't drive syncs.
  if (!user || user.channelToken !== token) return;

  try {
    await sync.pullChanges(user.id);
  } catch (err) {
    console.error('[calendar] webhook sync failed:', err.message);
  }
}
