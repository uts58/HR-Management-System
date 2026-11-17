# HR Management System: new app (`web/`)

This is the Next.js rewrite of the legacy Express/EJS app at the repo root.
Both apps live side by side until cutover. See
[`docs/platform/deployment.md`](../docs/platform/deployment.md) for the
deployment topology and the cutover runbook.

## Stack

| Concern    | Choice (pinned in `package.json`)                                 |
| ---------- | ----------------------------------------------------------------- |
| Runtime    | Node.js 26 LTS (`.nvmrc`), engines `>=24.11`                      |
| Framework  | Next.js 16.4 (App Router, Turbopack, `output: "standalone"`)      |
| UI         | React 19.3, Tailwind CSS 4.3, shadcn/ui (`base-nova`, Base UI)    |
| Language   | TypeScript 6.0, `strict` + `noUncheckedIndexedAccess`             |
| Data       | Prisma ORM 7.10 (`prisma-client` generator, `@prisma/adapter-pg`) |
| Auth       | Better Auth 1.7 + `@better-auth/prisma-adapter`                   |
| Validation | Zod 4                                                             |
| Passwords  | `@node-rs/argon2`                                                 |
| Dates      | date-fns 4 (org time zone via `APP_TIME_ZONE`)                    |
| Tests      | Vitest 5 (unit + integration projects), Playwright 1.65 (e2e)     |
| Lint       | ESLint 9 flat config (`eslint-config-next`) + Prettier 3          |

## Local setup

Prerequisites: Node 26 (`nvm use` in `web/`), npm, Docker.

```bash
# 1. Start Postgres (creates hrdb, hr_web, hr_web_test on first run)
docker compose -f compose.dev.yml up -d        # run from the repo root

# 2. Install and configure
cd web
npm ci                                         # also runs `prisma generate`
cp .env.example .env                           # then set BETTER_AUTH_SECRET:
#   openssl rand -base64 32

# 3. Database
npm run db:migrate                             # prisma migrate dev
npm run db:seed                                # once Data adds prisma/seed.ts

# 4. Run
npm run dev                                    # http://localhost:3000
```

## Scripts

| Script                    | What it does                                                 |
| ------------------------- | ------------------------------------------------------------ |
| `dev` / `build` / `start` | Next.js dev server / production build / production server    |
| `lint` / `lint:fix`       | ESLint (zero warnings allowed in CI)                         |
| `format` / `format:check` | Prettier (with Tailwind class sorting)                       |
| `typecheck`               | `next typegen && tsc --noEmit`                               |
| `test`                    | Vitest **unit** project (no DB)                              |
| `test:integration`        | Vitest **integration** project (needs `DATABASE_URL`)        |
| `test:e2e`                | Playwright (`tests/e2e`; starts `npm run dev` automatically) |
| `db:migrate`              | `prisma migrate dev` (create and apply migrations locally)   |
| `db:migrate:deploy`       | `prisma migrate deploy` (CI / production)                    |
| `db:seed`                 | `prisma db seed` → `tsx prisma/seed.ts`                      |
| `db:studio`               | Prisma Studio                                                |
| `db:generate`             | Regenerate the Prisma client into `src/generated/prisma`     |

## Environment variables

Validated at server start by [`src/env.ts`](src/env.ts). If a variable is
missing or invalid, the process exits. Import `env` from `@/env` and do not
read `process.env` directly.

| Variable              | Required | Example                                              |
| --------------------- | -------- | ---------------------------------------------------- |
| `DATABASE_URL`        | yes      | `postgresql://hruser:changeme@localhost:5432/hr_web` |
| `BETTER_AUTH_SECRET`  | yes      | 32+ random chars (`openssl rand -base64 32`)         |
| `BETTER_AUTH_URL`     | yes      | `http://localhost:3000`                              |
| `APP_TIME_ZONE`       | no       | `Asia/Dhaka` (default)                               |
| `LOG_LEVEL`           | no       | `info` (default)                                     |
| `SKIP_ENV_VALIDATION` | no       | `1` skips validation, for builds without secrets     |

To add a variable, update `src/env.ts`, `.env.example`, this table,
`docker-compose.yml` (`web` service) and the CI job env if tests need it.

## Where things go

| Path                                                          | Owner     | Notes                                             |
| ------------------------------------------------------------- | --------- | ------------------------------------------------- |
| `src/app/`, `src/components/`                                 | Frontend  | `components/ui/` is managed by `npx shadcn add …` |
| `src/server/`                                                 | Backend   | **Only** place that may import the Prisma client  |
| `src/lib/` (`validation/` etc.)                               | Backend   | `lib/utils.ts` is the shadcn `cn` helper          |
| `src/auth/`, `src/proxy.ts`                                   | Security  | Next 16 renamed `middleware.ts` to `proxy.ts`     |
| `src/contracts/`                                              | Architect | Shared types and contracts                        |
| `prisma/`                                                     | Data      | Schema, migrations, `seed.ts`                     |
| `tests/unit`, `tests/integration`, `tests/e2e`                | QA        | Unit tests may also be co-located as `*.test.ts`  |
| `src/env.ts`, `src/instrumentation.ts`, configs, `Dockerfile` | Platform  |                                                   |

ESLint enforces the data-access boundary. Importing `@prisma/client`,
`@prisma/adapter-*` or `@/generated/prisma/*` outside `src/server/**` and
`prisma/**` is an error.

The Prisma client is generated to `src/generated/prisma` (gitignored). Import
it as `@/generated/prisma/client`, not from `@prisma/client`. Prisma 7
requires a driver adapter:

```ts
// src/server/db.ts (Backend)
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/env";

export const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});
```

## Adding dependencies

`.npmrc` sets `save-exact=true`, so `npm install <pkg>` pins exact versions.
Commit `package-lock.json`. Use stable releases only. Note: `prisma`'s npm
`latest` tag currently points at an 8.0 RC, so always install
`prisma@7.x` / `@prisma/client@7.x` explicitly until we decide to upgrade.
Platform reviews changes to `package.json` (see `.github/CODEOWNERS`).

## Next.js 16 notes

- `cacheComponents` is on (create-next-app default). Request-time data such as
  cookies, headers and the session must be read inside a `<Suspense>`
  boundary, or the code must opt into caching with `"use cache"`.
- Read `node_modules/next/dist/docs/` before relying on older Next.js
  knowledge (see `AGENTS.md`).

## Docker

```bash
docker build -t hr-web ./web                         # runtime image
docker build -t hr-web-migrate --target migrator ./web
docker compose --profile web up -d --build           # from repo root: db + migrate + web on :3001
```

Migrations run in the separate `migrator` image (`prisma migrate deploy`), not
when the app starts. See the header of `Dockerfile`.
