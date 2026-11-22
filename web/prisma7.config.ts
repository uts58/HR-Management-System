// Prisma ORM 7 CLI config. Prisma 7.10+ recommends the `prisma7.config.ts`
// filename so it does not clash with the Prisma 8 `prisma.config.ts` format.
// The Prisma 7 CLI does not load .env files itself, hence dotenv.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Plain process.env (not prisma's env() helper) so `prisma generate`
    // works without a database URL, e.g. during `npm ci` / docker build.
    url: process.env.DATABASE_URL ?? "",
  },
});
