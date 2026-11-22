# HR Management System

A web app for managing employees, departments and positions, leave requests,
performance appraisals and company notices. Three roles share one login:
`HR_ADMIN` and `HR` manage people and records, and employees see their own
data and the notice board.

The app lives in [`web/`](web/). Deployment files (`docker-compose.yml`,
`compose.dev.yml`, `compose.prod.yml`, `docker/`) are at the repo root.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 and shadcn/ui,
Prisma 7 on PostgreSQL 16, Better Auth with argon2id passwords, Zod 4,
Vitest and Playwright. Full table and conventions: [`web/README.md`](web/README.md).

## Local development

Prerequisites: Node 26 (`nvm use` in `web/`), npm, Docker.

```bash
docker compose -f compose.dev.yml up -d     # Postgres on 127.0.0.1:5432
cd web
npm ci
cp .env.example .env                        # set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate
npm run db:seed                             # dev data (admin / Admin#12345)
npm run dev                                 # http://localhost:3000
```

## Tests

Run from `web/`:

```bash
npm run lint && npm run format:check && npm run typecheck
npm test                                    # unit
npm run test:integration                    # needs DATABASE_URL (a *_test database)
npm run test:e2e                            # Playwright
```

CI (`.github/workflows/ci.yml`) runs all of these plus a build and a Docker
image build. See [`docs/qa/test-strategy.md`](docs/qa/test-strategy.md).

## Create the first admin

A fresh database has no users. With `DATABASE_URL`, `BETTER_AUTH_SECRET` and
`BETTER_AUTH_URL` set:

```bash
cd web
CREATE_ADMIN_PASSWORD='a-strong-password' npm run create-admin -- --username admin
```

The command is idempotent and never prints the password.

## Deploy

See [`docs/platform/deployment.md`](docs/platform/deployment.md) for the
topology (Caddy, Next.js, Postgres), required environment variables, backups
and the launch runbook. Copy `.env.example` to `.env` and fill it in first.

## Documentation

- [`docs/architecture/`](docs/architecture/): ADRs and service contracts
- [`docs/data/`](docs/data/): schema decisions
- [`docs/qa/`](docs/qa/): test strategy
- [`docs/platform/`](docs/platform/): deployment

## License

See [`LICENSE`](LICENSE).
