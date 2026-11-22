# ADR-0008: Testing strategy

- Status: Accepted
- Date: 2026-11-17

## Decision

| Layer | Tool | Where | Owner | What |
|---|---|---|---|---|
| Schemas | Vitest | `web/src/lib/validation/*.test.ts` | Backend | Valid/invalid cases for every field rule in contracts.md |
| Services (unit) | Vitest, no DB | `web/src/server/**/*.test.ts` | Backend | `defineAction`, error mapping, pure logic |
| Services (integration) | Vitest + **real Postgres** | `web/tests/integration/server/` | Backend | Business rules, role/ownership checks, error codes. Data is truncated between tests. Prisma is **not** mocked. |
| Auth (unit) | Vitest | `web/src/auth/**/*.test.ts` | Security | `requireRole` behaviour, hashing, `mustChangePassword` gating |
| Auth (integration) | Vitest + real Postgres | `web/tests/integration/auth/` | Security | Sign-in, argon2id-only hashes, disabled users, `AccountAdminApi` in transactions |
| Authorization matrix | Vitest | `web/tests/authz/` | QA | Every exported server action × {anonymous, EMPLOYEE, HR_ADMIN, terminated employee} → expected code. Fails if an action has no row. |
| Components | Vitest + Testing Library (jsdom) | `web/src/components/**` | Frontend | Only for components with logic (forms, tables with filters). No snapshot tests. |
| E2E | Playwright | `web/tests/e2e/` | QA | One journey per row, run per role, against the Docker image with a seeded DB |

Rules:

1. CI (Platform) runs typecheck, lint, Vitest (with a Postgres service) and Playwright on every PR to `main`. All must pass to merge.
1a. Integration suites live under `web/tests/integration/`: `server/` (Backend), `auth/` (Security), the rest QA. **Test databases must be named `*_test` or `*_it`.** The shared setup refuses to truncate or migrate any other database name, so a misconfigured `DATABASE_URL` can't wipe real data.
2. Every bug fixed relative to legacy behaviour gets a test that names it (e.g. `"employee cannot open another employee's profile (legacy IDOR)"`).
3. Seed data for tests and E2E comes from a single fixture module in `web/tests/fixtures` (QA), built on the Data lead's seed.
4. Coverage target: services ≥ 90% lines, no global gate elsewhere.
5. E2E selectors use roles and labels (`getByRole`, `getByLabel`), which also checks basic accessibility.

## Consequences

- Real-DB service tests are slower than mocks, but they catch Prisma/schema mismatches, which is the main risk while the schema is being written in parallel.
