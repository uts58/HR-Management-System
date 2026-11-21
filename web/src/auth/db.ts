import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/env";

/**
 * Prisma client used by web/src/auth (Better Auth adapter, session lookups,
 * AccountAdminApi).
 *
 * TODO(merge with Backend): ADR-0002 says there is ONE PrismaClient, in
 * web/src/server/db.ts (Backend). That file does not exist yet, so auth has
 * its own instance for now. When Backend's lands, replace this whole file
 * with:
 *
 *   export { prisma } from "@/server/db";
 *
 * Nothing else in web/src/auth needs to change.
 */
const globalForPrisma = globalThis as unknown as {
  __authPrisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.__authPrisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

if (env.NODE_ENV !== "production") globalForPrisma.__authPrisma = prisma;

/** Transaction client type, for AccountAdminApi's generic `tx` parameter. */
export type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
