import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { rawDb?: PrismaClient };

/**
 * Unaudited Prisma client. Only `platform/db/seed.ts` and the audit writer use
 * this directly; application code uses `db` from `@platform/db/client`.
 * Cached on globalThis so dev-server hot reloads do not open new pools.
 */
export const rawDb: PrismaClient = globalForPrisma.rawDb ?? new PrismaClient();
globalForPrisma.rawDb = rawDb;
