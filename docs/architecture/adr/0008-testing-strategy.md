# ADR-0008: Testing strategy

- Status: Accepted
- Date: 2026-11-17

## Decision

| Layer | Tool | Where | Owner | What |
|---|---|---|---|---|
| Legacy characterisation | Playwright (HTTP + browser) | `legacy-tests/` | QA | Record what the legacy app actually does for each route in feature-map.md, including the bugs. This is the baseline for the parity checklist. |
| Schemas | Vitest | `web/src/lib/validation/*.test.ts` | Backend | Valid/invalid cases for every field rule in contracts.md |
| Services | Vitest + **real Postgres** | `web/src/server/**/*.test.ts` | Backend | Business rules, role/ownership checks, error codes. One DB per run (docker compose service or Testcontainers, Platform's choice). Data is truncated between tests. Prisma is **not** mocked. |
| Auth | Vitest | `web/src/auth/**/*.test.ts` | Security | `requireRole` behaviour, hashing, `mustChangePassword` gating |
| Authorization matrix | Vitest | `web/tests/authz/` | QA | Every exported server action × {anonymous, EMPLOYEE, HR_ADMIN} → expected code. Fails if an action has no row. |
| Components | Vitest + Testing Library (jsdom) | `web/src/components/**` | Frontend | Only for components with logic (forms, tables with filters). No snapshot tests. |
| E2E | Playwright | `web/tests/e2e/` | QA | One journey per row in feature-map.md, run per role, against the Docker image with a seeded DB |
| Migration | Vitest | `scripts/migrate-legacy/` | Data | Fixture legacy DB → migrate → assert counts, id preservation, date parsing report |

Rules:

1. CI (Platform) runs typecheck, lint, Vitest (with a Postgres service) and Playwright on every PR to `main`. All must pass to merge.
2. Every bug fixed relative to legacy behaviour gets a test that names it (e.g. `"employee cannot open another employee's profile (legacy IDOR)"`).
3. Seed data for tests and E2E comes from a single fixture module in `web/tests/fixtures` (QA), built on the Data lead's seed.
4. Coverage target: services ≥ 90% lines, no global gate elsewhere.
5. E2E selectors use roles and labels (`getByRole`, `getByLabel`), which also checks basic accessibility.

## Consequences

- Real-DB service tests are slower than mocks, but they catch Prisma/schema mismatches, which is the main risk while the schema is being written in parallel.
