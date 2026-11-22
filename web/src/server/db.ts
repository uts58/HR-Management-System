import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { dbEnv } from "@/db-env";

export type Db = PrismaClient;
export type Tx = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { __hrPrisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbEnv.DATABASE_URL }),
  });
}

export const db: PrismaClient = globalForPrisma.__hrPrisma ?? createClient();

if (dbEnv.NODE_ENV !== "production") globalForPrisma.__hrPrisma = db;
