# Test strategy

Owner: QA Lead. Decisions behind this: [ADR-0008](../architecture/adr/0008-testing-strategy.md) and [ADR-0009](../architecture/adr/0009-legacy-parity-definition-of-done.md).

## 1. Goals

1. Every user-facing behaviour is proven by a test at the cheapest layer that can catch a regression.
2. Business rules and authorization are covered by unit and integration tests, and E2E stays at user journeys.
3. Fast feedback: unit tests run in seconds, integration tests use a real database, E2E runs against the built app.

## 2. Layers

| Layer       | Tool                          | Where                                   | Command                    |
| ----------- | ----------------------------- | --------------------------------------- | -------------------------- |
| Unit        | Vitest, no I/O                | `web/src/**/*.test.ts`                  | `npm test`                 |
| Integration | Vitest + real Postgres        | `web/tests/integration`                 | `npm run test:integration` |
| E2E         | Playwright (Chromium)         | `web/tests/e2e`                         | `npm run test:e2e`         |

All commands run from `web/`.

### 2.1 Unit

- Validation schemas, authorization policy, error mapping, date and leave rules, formatting.
- No Prisma, no network, no Next runtime.

### 2.2 Integration

- Needs `DATABASE_URL` pointing at a throwaway database whose name ends in `_test` or `_it`. The reset helper refuses any other name.
- Prisma is not mocked. These tests catch what mocks hide: constraints, transactions, case-insensitive lookups, ordering.
- Every mutating action is checked as anonymous (rejected), as employee (forbidden where HR-only) and as HR (succeeds).

### 2.3 E2E

- Specs are one file per area under `web/tests/e2e`. Page objects live in `web/tests/support/pages/` and use roles, labels and visible text only.
- Fixtures sign in through `POST /api/auth/sign-in/username`. The login form itself is covered in `auth.spec.ts`.
- `web/tests/support/db/reset.ts` truncates every table except `_prisma_migrations`, runs `prisma/seed.ts`, then loads `qa-fixtures.sql`. It refuses databases not named `*_test` or `*_it`. `E2E_DB_RESET=0` skips the reset.
- Specs are parallel-safe: created records get unique names (`uid()`), and a test that changes a user changes that user's own fixture account. Every fixture account uses the password `QaPass#2026`.
- Each browser context sends its own `X-Forwarded-For`, so Better Auth's per-IP and per-username limits apply per test.
- `@backend` specs run only when `E2E_BACKEND=1`. CI sets it.
- `BETTER_AUTH_URL` must equal the browser origin, or Better Auth returns 403 on a mismatched Origin.

```bash
export DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/hr_web_test
cd web && npx prisma migrate deploy
E2E_BACKEND=1 npm run test:e2e
```

## 3. Non-functional gates

- ESLint (zero warnings), Prettier and `tsc --noEmit` run in CI.
- Accessibility: no serious or critical violations on the main pages.
- Security: `npm audit --omit=dev` at high severity.

## 4. CI

`.github/workflows/ci.yml` runs `web / lint, typecheck, unit tests`, `web / build`, `web / integration tests (Postgres)`, `web / e2e (Playwright)` and `web / docker build` on every pull request.
