/**
 * Minimal Google OAuth2 + Calendar client.
 *
 * No `googleapis` dependency: that package is ~50MB and pulls in a discovery
 * layer we don't need. This is plain fetch against four documented endpoints,
 * which also makes every request trivially testable by swapping global.fetch.
 */
import prisma from '../config/db.js';
import { encrypt, decrypt } from '../utils/crypto.js';

const OAUTH_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN = 'https://oauth2.googleapis.com/token';
const OAUTH_REVOKE = 'https://oauth2.googleapis.com/revoke';
const CAL_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * calendar.events covers read+write on events; calendar.readonly lets us list
 * which calendars exist so the user can choose one. We deliberately do NOT ask
 * for the full `calendar` scope — it grants calendar deletion, which we never do.
 */
export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
  'profile',
];

export class GoogleApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
    this.body = body;
  }
}

function cfg() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect = process.env.GOOGLE_REDIRECT_URI;
  if (!id || !secret || !redirect) {
    const err = new Error('Google Calendar is not configured on this server');
    err.status = 503;
    throw err;
  }
  return { id, secret, redirect };
}

export const isConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);

/** Build the consent URL. `state` is a signed nonce — see calendarController. */
export function buildAuthUrl(state) {
  const { id, redirect } = cfg();
  const p = new URLSearchParams({
    client_id: id,
    redirect_uri: redirect,
    response_type: 'code',
    scope: SCOPES.join(' '),
    // offline + consent is what actually returns a refresh_token. Without
    // prompt=consent Google omits it on every authorisation after the first,
    // and the integration silently dies when the access token expires.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${OAUTH_AUTH}?${p}`;
}

async function tokenRequest(params) {
  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GoogleApiError(body.error_description || body.error || 'Token request failed', res.status, body);
  }
  return body;
}

export async function exchangeCode(code) {
  const { id, secret, redirect } = cfg();
  return tokenRequest({
    code,
    client_id: id,
    client_secret: secret,
    redirect_uri: redirect,
    grant_type: 'authorization_code',
  });
}

export async function refreshAccessToken(refreshToken) {
  const { id, secret } = cfg();
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: id,
    client_secret: secret,
    grant_type: 'refresh_token',
  });
}

export async function revokeToken(token) {
  await fetch(OAUTH_REVOKE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => {});
}

/**
 * Return a valid access token for a user, refreshing if it is within 60s of
 * expiry. The refreshed token is persisted encrypted so parallel requests in
 * the same process don't each burn a refresh.
 */
export async function getAccessToken(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleAccessToken: true, googleRefreshToken: true, googleTokenExpiry: true },
  });
  if (!user?.googleRefreshToken) {
    const err = new Error('Google Calendar is not connected');
    err.status = 428; // Precondition Required — the client should prompt to connect
    throw err;
  }

  const stillValid = user.googleTokenExpiry && user.googleTokenExpiry.getTime() - Date.now() > 60_000;
  if (stillValid && user.googleAccessToken) return decrypt(user.googleAccessToken);

  const refreshed = await refreshAccessToken(decrypt(user.googleRefreshToken));
  const expiry = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: encrypt(refreshed.access_token),
      googleTokenExpiry: expiry,
      // Google only re-issues refresh_token occasionally; keep the old one otherwise.
      ...(refreshed.refresh_token ? { googleRefreshToken: encrypt(refreshed.refresh_token) } : {}),
    },
  });
  return refreshed.access_token;
}

/**
 * Authenticated Calendar API call with one automatic retry on 401 (token
 * revoked mid-flight) and bounded exponential backoff on 403 rate-limit /
 * 5xx. Google's quota errors are 403 with a specific reason, not 429.
 */
export async function calendarFetch(userId, path, { method = 'GET', body, query, retries = 3 } = {}) {
  let attempt = 0;
  let refreshedOnce = false;

  for (;;) {
    const token = await getAccessToken(userId);
    const qs = query ? `?${new URLSearchParams(query)}` : '';
    const res = await fetch(`${CAL_BASE}${path}${qs}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (res.ok) return data;

    // 410 GONE: the sync token is stale. Surface it so the caller can full-resync.
    if (res.status === 410) throw new GoogleApiError('Sync token expired', 410, data);

    if (res.status === 401 && !refreshedOnce) {
      // Force a refresh by expiring our cached copy, then retry once.
      refreshedOnce = true;
      await prisma.user.update({ where: { id: userId }, data: { googleTokenExpiry: new Date(0) } });
      continue;
    }

    const reason = data?.error?.errors?.[0]?.reason;
    const retryable =
      res.status >= 500 ||
      (res.status === 403 && ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded'].includes(reason));

    if (retryable && attempt < retries) {
      const wait = Math.min(2 ** attempt * 500, 8000) + Math.random() * 250;
      await new Promise((r) => setTimeout(r, wait));
      attempt += 1;
      continue;
    }

    throw new GoogleApiError(data?.error?.message || `Calendar API ${res.status}`, res.status, data);
  }
}

// ---------- thin endpoint wrappers ----------

export const listCalendars = (userId) =>
  calendarFetch(userId, '/users/me/calendarList', { query: { minAccessRole: 'writer', maxResults: '50' } });

export const insertEvent = (userId, calendarId, event) =>
  calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body: event });

export const patchEvent = (userId, calendarId, eventId, patch) =>
  calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: patch,
  });

export const getEvent = (userId, calendarId, eventId) =>
  calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);

export const deleteEvent = (userId, calendarId, eventId) =>
  calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });

export const listEvents = (userId, calendarId, query) =>
  calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events`, { query });

export const watchEvents = (userId, calendarId, channel) =>
  calendarFetch(userId, `/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
    method: 'POST',
    body: channel,
  });

export const stopChannel = (userId, id, resourceId) =>
  calendarFetch(userId, '/channels/stop', { method: 'POST', body: { id, resourceId } });
