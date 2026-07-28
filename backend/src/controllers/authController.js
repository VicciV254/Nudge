import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { signAccess, newRefreshToken, refreshExpiry } from '../utils/jwt.js';

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
