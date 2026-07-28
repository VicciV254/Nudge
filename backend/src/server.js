import 'dotenv/config';
import { createApp } from './app.js';
import prisma from './config/db.js';

const PORT = Number(process.env.PORT || 5000);

// Fail at boot, not on the first request that happens to need them.
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = createApp();

// Background calendar jobs (watch renewal + stale-account polling).
const { startScheduler } = await import('./services/watchRenewal.js');
startScheduler();
const server = app.listen(PORT, () => {
  console.log(`Nudge API listening on http://localhost:${PORT}`);
});

async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down…`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Don't hang forever if a connection refuses to close.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
