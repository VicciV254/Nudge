import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import prisma from '../config/db.js';
import { signAccess, newRefreshToken, refreshExpiry, signState, verifyState } from '../utils/jwt.js';
import * as g from '../services/googleClient.js';

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const PUBLIC_USER = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  timezone: true,
  plan: true,
  tasksCompleted: true,
  streak: true,
  calendarSyncEnabled: true,
};

async function issueSession(user, req) {
  const refreshToken = newRefreshToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      expiresAt: refreshExpiry(),
      userAgent: req.headers['user-agent']?.slice(0, 255),
      ipAddress: req.ip,
    },
  });
  return { accessToken: signAccess(user), refreshToken };
}

export async function register(req, res) {
  const { email, password, displayName, timezone } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash, displayName, timezone: timezone || 'UTC' },
    select: PUBLIC_USER,
  });

  const tokens = await issueSession(user, req);
  res.status(201).json({ user, ...tokens });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const record = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Compare against a dummy hash when the user is missing so the response time
  // does not reveal whether an account exists.
  const hash = record?.passwordHash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const ok = await bcrypt.compare(password, hash);

  if (!record || !ok) {
    return res.status(401).json({ error: 'That email and password combination did not work' });
  }

  await prisma.user.update({ where: { id: record.id }, data: { lastActiveAt: new Date() } });

  const user = await prisma.user.findUnique({ where: { id: record.id }, select: PUBLIC_USER });
  const tokens = await issueSession(user, req);
  res.json({ user, ...tokens });
}

export async function refresh(req, res) {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'Missing refresh token' });

  const session = await prisma.session.findUnique({
    where: { refreshToken },
    include: { user: { select: PUBLIC_USER } },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }

  // Rotate: a refresh token is single-use, so a stolen one is only useful until
  // the real client next refreshes (at which point both are invalidated).
  const rotated = newRefreshToken();
  await prisma.session.update({
    where: { id: session.id },
    data: { refreshToken: rotated, expiresAt: refreshExpiry() },
  });

  res.json({ accessToken: signAccess(session.user), refreshToken: rotated, user: session.user });
}

export async function logout(req, res) {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    await prisma.session.deleteMany({ where: { refreshToken } });
  }
  res.status(204).end();
}

export async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: PUBLIC_USER });
  res.json(user);
}

/** GET /api/auth/google -> redirects the browser straight to Google's consent screen. */
export function googleStart(req, res) {
  if (!g.isConfigured()) {
    // JSON here would just show as a broken redirect to the user; send them
    // somewhere they can read the message instead.
    return res.redirect(`${APP_URL}/login?google=unavailable`);
  }
  const state = signState({ purpose: 'login', nonce: crypto.randomBytes(8).toString('hex') });
  res.redirect(g.buildLoginAuthUrl(state));
}

/**
 * GET /api/auth/google/callback (login branch — see authRoutes.js for the
 * dispatch between this and the calendar-connect callback, which shares the
 * same redirect_uri registered with Google).
 *
 * Finds an existing user by googleId or email, links the Google account if
 * it was previously email/password-only, or creates a new account. Then
 * issues a normal session and hands the tokens to the frontend via redirect
 * query params, since this leg is a full-page navigation (no XHR to read a
 * JSON body from).
 */
export async function googleLoginCallback(req, res) {
  const { code, state, error } = req.query;
  const fail = (reason) => res.redirect(`${APP_URL}/login?google=${reason}`);

  if (error) return fail('denied');
  if (!code || !state) return fail('invalid');

  try {
    verifyState(state);
  } catch {
    return fail('expired');
  }

  try {
    const tokenRes = await g.exchangeCode(code);
    const profile = await g.getUserInfo(tokenRes.access_token);
    if (!profile.email) return fail('no_email');

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: profile.sub }, { email: profile.email.toLowerCase() }] },
    });

    if (user) {
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.sub, avatarUrl: user.avatarUrl || profile.picture || null },
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email: profile.email.toLowerCase(),
          googleId: profile.sub,
          displayName: profile.name || profile.email.split('@')[0],
          avatarUrl: profile.picture || null,
          timezone: 'UTC',
        },
      });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });

    const publicUser = await prisma.user.findUnique({ where: { id: user.id }, select: PUBLIC_USER });
    const { accessToken, refreshToken } = await issueSession(publicUser, req);

    return res.redirect(
      `${APP_URL}/auth/callback?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`
    );
  } catch (err) {
    console.error('[auth] google sign-in failed:', err.message);
    return fail('failed');
  }
}
