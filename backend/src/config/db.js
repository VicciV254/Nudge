import { PrismaClient } from '@prisma/client';

/**
 * One Prisma client per process.
 *
 * `globalThis` caching matters in dev: `node --watch` re-imports modules on
 * every save, and without this you leak a connection pool each time — which on
 * Neon's free tier will exhaust your connection limit within a few minutes.
 */
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__nudgePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.__nudgePrisma = prisma;

export default prisma;
