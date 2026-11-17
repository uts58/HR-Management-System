# Test Strategy: HR Management System Rewrite (Next.js)

Owner: QA Lead. Status: Phase 0.
Related: [`feature-inventory.md`](./feature-inventory.md) (functional spec + known defects), [`../../legacy-tests/`](../../legacy-tests) (legacy E2E parity suite).

## 1. Goals
1. **Parity:** every user-facing behaviour in the inventory works in `web/`, proven by the same E2E scenarios that pass on legacy.
2. **Fix, don't port, the defects:** the known defects (BUG-xx, SEC-xx) are written as tests for the *correct* behaviour. They are expected to fail on legacy and must pass in `web/`.
3. **Fast feedback:** most checks run in milliseconds (unit), real database behaviour is covered by integration tests, and E2E is kept to user journeys.

## 2. Test pyramid for `web/`

| Layer | Tool | Runs against | What belongs here | Rough count |
|---|---|---|---|---|
| Unit | Vitest | pure TS, no I/O | validation schemas (zod or similar), services with repositories mocked, authorization policy (`can(user, action, resource)`), date/leave rules, password hashing wrapper, formatting (status labels, `N/5`) | 150+ |
| Integration | Vitest + real Postgres (Docker / Testcontainers) | Prisma + service layer + route handlers / server actions | persistence and constraints (FKs, unique usernames, cascade/block rules), transactions (employee + login creation), authz on every mutating endpoint, CSRF/verb rules, session lifecycle | 60-100 |
| E2E | Playwright | built Next.js app + seeded Postgres | the user journeys from `legacy-tests`, ported; role enforcement through the UI | about 50 (the legacy count) |

### 2.1 Unit (Vitest)
- Location: next to the code (`web/src/**/*.test.ts`) or `web/tests/unit`.
- Must cover every validation rule in the inventory, including the rules legacy lacks:
  - employee: required fields, email format, contact digits, department/position exist, DOB is a real date.
  - leave: dates required and ISO, `end >= start`, type in the allowed list.
  - appraisal: employee required, rating integer 1-5, `end >= start`.
  - department/position: trimmed, non-empty, unique (case-insensitive), length limit.
  - notice: title/body required, type in {General, Urgent, Holiday}.
  - password: non-empty, minimum length, confirm matches, current is verified (BUG-05).
- Authorization policy as a pure function with a table-driven test: role × action → allow/deny. This is the single source of truth that SEC-01/02 are closed.
- No Prisma, no network, no Next runtime. Target < 10 s for the whole layer.

### 2.2 Integration (Vitest + real Postgres)
- Location: `web/tests/integration`. Separate Vitest project/config (`vitest.integration.config.ts`), run with `--pool=forks` and one DB per worker (schema-per-worker or Testcontainers).
- DB lifecycle: `prisma migrate deploy` once per run, then `TRUNCATE ... RESTART IDENTITY CASCADE` + fixture insert before each test file (same idea as `legacy-tests/fixtures/seed.sql`).
- **Do not mock Prisma here.** These tests exist to catch what mocks hide: constraint violations, transaction rollback, case-insensitive lookups, ordering.
- Must cover:
  - Every mutating route handler / server action is called as anonymous (rejected), as employee (403 where HR-only), and as HR (succeeds). This is generated from the policy table so nothing is missed.
  - Mutations reject GET and require a CSRF token / same-site protection (SEC-04/05). Login regenerates the session (SEC-06). Passwords are stored hashed (SEC-03): assert the DB column is not the plaintext.
  - Employee create is atomic (employee + credentials) and returns a usable credential path (BUG-03). Usernames are unique (BUG-24).
  - Department/position delete when in use is blocked (BUG-07); employee delete handles leave and appraisals per the product decision (BUG-08).
  - Unknown ids give 404, not 500 (BUG-09/10).
  - Leave decision accepts only Approved/Rejected (BUG-21) and sets the employee's unread flag. Viewing history clears it.
  - Notice ordering is explicit (by created timestamp), and the timestamp is stored as a real timestamp (BUG-13).

### 2.3 E2E (Playwright)
- Location: `web/tests/e2e`, ported from `legacy-tests` (section 4).
- Runs against `next build && next start` (not `next dev`) with a seeded Postgres. Chromium on every PR; Firefox and WebKit nightly.
- Only user-visible assertions: labels, headings, button and link names, visible messages, table rows. Never DB rows or CSS classes.
- Serial (one worker) with a DB reset in `globalSetup`, plus unique per-test data (`uid()`) so specs don't depend on each other. Parallel workers can come later if each worker gets its own DB.

### 2.4 Also required (non-functional)
- **Accessibility:** `@axe-core/playwright` scan on each main page in E2E; zero serious/critical violations. Legacy fails this (unlabelled inputs, BUG-15), so there is no parity baseline. The new UI must pass on its own.
- **Lint / type-check:** `tsc --noEmit` and ESLint as CI gates.
- **Security:** `npm audit --omit=dev` (high+) gate. The Security lead owns deeper review; QA owns the regression tests in 2.2.

## 3. Coverage targets

| Scope | Target | Gate |
|---|---|---|
| `web/src/lib/validation/**`, `web/src/lib/auth/**` (policy, password, session) | 95% lines, 90% branches | CI fails below |
| Services / server actions / route handlers (unit + integration combined) | 85% lines, 75% branches | CI fails below |
| UI components | no numeric target; covered by E2E + a11y | none |
| Feature inventory | 100% of features have at least one E2E test; 100% of BUG/SEC items marked E2E or integration have a test | parity checklist (section 5) |

Coverage is measured with Vitest's `v8` provider, merged across the unit and integration runs. Don't chase the number by unit-testing Prisma calls through mocks; integration tests are the right place for those.

## 4. Porting `legacy-tests` to `web/tests/e2e`

The legacy suite was written to make this mostly mechanical:

| Layer in legacy-tests | What changes when porting |
|---|---|
| `tests/*.spec.ts` (scenarios) | **Copy as is.** They only use page objects and user-visible text. |
| `support/routes.ts` | Map each key to the Next.js route. |
| `support/pages/*.ts` | Update locators only where the new UI differs. Prefer `getByRole` / `getByLabel`; delete the legacy CSS fallbacks in `field()` once the new UI has properly labelled inputs. Native `confirm()`/`alert()` handling lives in `Dialogs`; switch it to modal buttons / inline messages there, not in the specs. |
| `support/fixtures.ts` | Login stays UI-driven for the auth specs. Other specs can switch to `storageState` from a setup project for speed. |
| `fixtures/seed.sql` + `scripts/reset-db.mjs` | Replace with the new schema's equivalent (`web/prisma/seed-test.ts` or SQL). **Keep the same users, passwords and names** (`support/data.ts`), so the scenarios don't change. |
| `support/defects.ts` | Run with `FIXED_DEFECTS=all`. Any test still failing is a parity or defect gap. Once green, delete `knownDefect()` calls from the ported copy. |

Rules:
1. A ported scenario may change *how* it finds something (locator) but not *what* it asserts. If the assertion itself must change (e.g. product decided a different message), record the decision in the inventory and link the PR.
2. Text assertions use case-insensitive regexes on the meaningful words (`/saved successfully/i`), not legacy typos ("Succuessfully" is matched by `/saved succ?u?essfully/i` on purpose; the new UI should spell it correctly).
3. New features or decisions (e.g. an employee viewing their own appraisals) get new specs in `web/tests/e2e`. Don't add them to `legacy-tests`.

## 5. Parity process

1. **Inventory is the contract.** Each feature in `feature-inventory.md` gets a row in the parity checklist (a GitHub project or table) with columns: feature, legacy test(s), web test(s), status (`not started` / `ported` / `green`), owner.
2. **A feature is done** when its ported E2E tests pass in `web/` CI, its unit/integration tests exist per section 2, and any linked BUG/SEC item is green with `FIXED_DEFECTS=all`.
3. **Legacy suite stays green against legacy** (with expected failures) until cut-over. If the Security lead's patch fixes SEC-01/02/BUG-xx, those `test.fail` tests start "unexpectedly passing", and Playwright reports that as a failure. That is the signal to add the ID to `FIXED_DEFECTS` in CI (and later remove the `knownDefect()` call).
4. **Behaviour changes need sign-off.** Any deliberate deviation from legacy, other than fixing a listed defect, needs a product decision recorded in inventory section 13 before the test is changed.
5. **Cut-over gate:** all checklist rows are green; the E2E suite is green on Chromium/Firefox/WebKit; coverage gates are met; zero open Critical/High defects; a11y scan is clean.

## 6. CI layout (proposed)

| Job | Trigger | Steps |
|---|---|---|
| `web-unit` | every PR touching `web/` | `vitest run --project unit --coverage` |
| `web-integration` | every PR touching `web/` | Postgres service container → `prisma migrate deploy` → `vitest run --project integration --coverage` |
| `web-e2e` | every PR touching `web/` | Postgres service → build → `next start` → reset/seed → `playwright test` (Chromium) |
| `legacy-e2e` | PRs touching the legacy app or `legacy-tests/`; nightly | Postgres service → `npx prisma db push` → `npm start` → `legacy-tests: npm test` |
| `web-e2e-matrix` | nightly | E2E on Firefox + WebKit, a11y scan |

## 7. Running the legacy suite locally

Requirements: Node 18+, Docker (or any Postgres 16), and the legacy app's dependencies (`npm ci` at repo root).

```bash
# 1. Postgres on a spare port (the suite truncates this database)
docker run -d --name hr-legacy-qa-db -e POSTGRES_DB=hrdb_qa -e POSTGRES_USER=hruser \
  -e POSTGRES_PASSWORD=qa_pass -p 55432:5432 postgres:16-alpine
export DATABASE_URL=postgresql://hruser:qa_pass@localhost:55432/hrdb_qa

# 2. Legacy app (repo root)
npm ci
npx prisma db push
PORT=3100 SESSION_SECRET=dev npm start          # or let Playwright start it: START_LEGACY=1

# 3. Suite
cd legacy-tests
npm ci
npx playwright install chromium
BASE_URL=http://localhost:3100 npm test          # globalSetup resets the DB from fixtures/seed.sql
npm run report                                   # HTML report
```

Environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | app under test |
| `DATABASE_URL` | (required unless `RESET_DB=0`) | DB to truncate and seed before the run |
| `RESET_DB` | `1` | `0` skips the reset (runs will not be repeatable) |
| `START_LEGACY` | unset | `1` makes Playwright start `node ../app.js` |
| `FIXED_DEFECTS` | empty | comma list of defect IDs (or `all`) that are no longer expected to fail |

Repeatability: `fixtures/seed.sql` truncates every table and loads the `prisma/seed.js` data plus QA-only users (`mary`, `temp`, `paula`, `olive`) and an in-use department and position, so destructive tests never touch shared data. Tests also create uniquely named records. The suite can be re-run any number of times; each run starts from the same state.
