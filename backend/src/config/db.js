import { PrismaClient } from '@prisma/client';

// One Prisma client per process: cached on globalThis so re-evaluating this module doesn't open another pool.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__nudgePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.__nudgePrisma = prisma;

export default prisma;
