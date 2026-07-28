import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const ACCESS_TTL = process.env.JWT_EXPIRE || '15m';
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_DAYS || 30);

function secret(name) {
  const v = process.env[name];
  // Fail loudly at boot rather than silently signing with `undefined`.
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const signAccess = (user) =>
  jwt.sign({ sub: user.id, email: user.email }, secret('JWT_SECRET'), {
    expiresIn: ACCESS_TTL,
  });

export const verifyAccess = (token) => jwt.verify(token, secret('JWT_SECRET'));

/**
 * Refresh tokens are opaque random strings stored in the sessions table, not
 * JWTs. That makes them revocable — a JWT refresh token cannot be invalidated
 * before it expires, so "log out everywhere" would be a lie.
 */
export const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');

export const refreshExpiry = () =>
  new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
