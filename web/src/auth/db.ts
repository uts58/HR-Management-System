import "server-only";

export { db as prisma, type Tx as TxClient } from "@/server/db";
