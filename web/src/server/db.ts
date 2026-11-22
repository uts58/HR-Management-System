import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { env } from "@/env";

export type Db = PrismaClient;
export type Tx = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { __hrPrisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
}

export const db: PrismaClient = globalForPrisma.__hrPrisma ?? createClient();

if (env.NODE_ENV !== "production") globalForPrisma.__hrPrisma = db;
