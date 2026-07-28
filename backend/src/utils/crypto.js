import crypto from 'node:crypto';

/**
 * AES-256-GCM for Google OAuth tokens at rest.
 *
 * GCM (not CBC) so the ciphertext is authenticated — a tampered token fails to
 * decrypt instead of silently producing garbage we would then send to Google.
 */
const ALGO = 'aes-256-gcm';

function key() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY is not set');
  const buf = Buffer.from(raw, 'hex');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  return buf;
}

export function encrypt(plain) {
  if (plain == null) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

export function decrypt(payload) {
  if (!payload) return null;
  const [iv, tag, data] = payload.split('.');
  if (!iv || !tag || !data) return null;
  const d = crypto.createDecipheriv(ALGO, key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}

/** Stable hash of an outgoing calendar payload, used to ignore our own webhooks. */
export const payloadHash = (obj) =>
  crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 32);
