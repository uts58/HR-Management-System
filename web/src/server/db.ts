/**
 * The single PrismaClient instance (Prisma 7 + PrismaPg adapter, ADR-0002).
 * Only `server/**`, `auth/**` and integration tests may import it.
 *
 * In development the client is cached on globalThis so hot reloads do not
 * open a new pool each time.
 */

import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { env } from "@/env";

/*
 * Known noise: integration runs print a pg DeprecationWarning ("Calling
 * client.query() when the client is already executing a query is deprecated
 * and will be removed in pg@9.0"). It is not from our code. Prisma's query
 * engine runs the relation sub-selects of one findUnique/findMany (e.g.
 * select: { department, position, user }) as concurrent statements on the
 * single connection of an interactive $transaction, and pg >= 8.19 warns about
 * that. Verified by instrumenting pg.Client.query: overlaps came only from
 * relation selects, never from sequential statements in our services. Do not
 * patch the adapter. Related pg report: brianc/node-postgres#3612. Revisit
 * when Prisma/@prisma/adapter-pg update. It cannot be made a test failure
 * without also failing on Prisma's own internals.
 */
export type Db = PrismaClient;
/** Interactive-transaction client, also what AccountAdminApi receives. */
export type Tx = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { __hrPrisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
}

export const db: PrismaClient = globalForPrisma.__hrPrisma ?? createClient();

if (env.NODE_ENV !== "production") globalForPrisma.__hrPrisma = db;
