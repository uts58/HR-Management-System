import "server-only";

/**
 * web/src/auth uses the app's single PrismaClient (ADR-0002: one client,
 * one connection pool), owned by Backend in web/src/server/db.ts.
 */
export { db as prisma, type Tx as TxClient } from "@/server/db";
