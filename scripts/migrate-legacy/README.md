# Legacy → v2 data migration

One-off script. It copies the legacy HR database (Express/EJS app, legacy `prisma/schema.prisma`) into the schema v2 database (`web/prisma/schema.prisma`).
Every rule it applies (each column, enum and date format, and how orphans are handled) is documented in [`docs/data/schema-decisions.md`](../../docs/data/schema-decisions.md).

## What it does

- Reads the legacy DB as **one read-only snapshot** (`REPEATABLE READ READ ONLY`).
- Writes the v2 DB in **one transaction**. A fatal error or a failed verification check rolls back everything.
- **Idempotent:** rows are upserted on their preserved legacy ids (users on `legacy_person_id`, credential accounts on `(provider_id, account_id)`). Re-running updates rows in place and never creates duplicates. `--reset` truncates the v2 tables first, for an exact copy.
- **Preserves ids** for employees, departments, positions, leave, notices and appraisals, then moves every sequence past `MAX(id)`.
- **Parses string dates** in the known legacy formats (`01 Jan 1990`, `YYYY-MM-DD`, `M/D/YYYY` from `toLocaleDateString()`, and more). An unparseable value becomes `NULL` and is reported, so the script never crashes on bad data. Ambiguous `03/04/2020` values are read with `--slash-order` and reported.
- **Passwords:** every migrated password ends up as a **bcrypt** hash on the Better Auth credential `account` row. Existing `$2a$`/`$2b$` hashes are copied unchanged. Remaining plaintext is hashed with bcrypt (cost `BCRYPT_COST`, default 12) **and those users get `must_change_password = true`**. Their passwords sat unhashed in the database. Users who were already bcrypt aren't forced. On a re-run, a hash from the previous run is reused if it still matches the legacy plaintext. Empty passwords get no credential account (HR issues one).
- **Usernames:** **keeps the legacy login, lower-cased,** when it is valid under the Better Auth username plugin's rules (3–30 chars, `[a-z0-9._]`) and unique case-insensitively. Otherwise it generates `first.last` (`first.last2`, `first.last3`… on collision; kept legacy names are reserved first). The `.usernames.csv` has `usernameChanged` / `usernameReason` columns, so HR only contacts people whose login changed.
- **Leave type:** maps the five legacy select labels to the `LeaveType` enum, ignoring case and whitespace. Anything else becomes `OTHER`, keeps its original text in `legacy_leave_type`, and is listed in `report.leaveTypeOther`.
- **Auth emails:** uses the employee's email when it's present, valid and unique. Otherwise uses the placeholder `<username>@users.invalid`. Every placeholder is listed in the report.
- **Org cleanup:** merges case-insensitive duplicate department/position names into the lowest id and reassigns their employees. Employees pointing at department/position `0` or at a deleted one get `NULL`.
- **Orphaned history:** leave/appraisal rows whose employee was hard-deleted in legacy are **kept**. They point to a placeholder `TERMINATED` employee (`Unknown employee #<id>`, `is_placeholder = true`). Rows with a non-numeric `empid` are rejected and reported.
- **Drops** the unused `message` table (the row count is reported).
- Prints a **verification report**: per-table counts (legacy, written, synthesized, merged, rejected, target), orphaned references, rejected rows, warnings and PASS/FAIL checks. The full report goes to JSON, plus a `.usernames.csv`.

## Prerequisites

- Node ≥ 20.19 (the repo uses Node 24).
- The v2 database already has the schema: from `web/`, run `npx prisma migrate deploy` (Prisma **7.10.1**; npm's `latest` tag points at an 8.0 RC, so don't use it).
- Network access to both databases. The script **only reads** from the legacy DB.

## Run

```bash
cd scripts/migrate-legacy
npm ci
cp .env.example .env    # or export the variables
# LEGACY_DATABASE_URL=postgresql://hruser:***@legacy-host:5432/hrdb
# DATABASE_URL=postgresql://hr:***@new-host:5432/hr_v2

npm run migrate:dry                         # full run, then ROLLBACK. Read the report.
npm run migrate -- --reset                  # first real load into an empty v2 DB (or to start over)
npm run migrate                             # later re-runs (upsert in place)
```

Flags (after `--`):

| Flag | Meaning |
|---|---|
| `--dry-run` | Do everything, print the report, then roll back. |
| `--reset` | `TRUNCATE` all v2 data and auth tables (users, accounts, sessions, verifications included) before loading. Use it for the final cutover so rows deleted in legacy since an earlier run are gone too. |
| `--slash-order MDY\|DMY` | How to read ambiguous `N/N/YYYY` dates. Default `MDY`: Node's default `toLocaleDateString()` is en-US, which is what wrote `notice.date`. Check a few legacy notice dates before cutover. |
| `--strict` | Exit with code 2 if any row was rejected. |
| `--report <path.json>` | Report location. Default `./migration-report-<timestamp>.json`. The username CSV is written next to it. |

Environment: `LEGACY_DATABASE_URL`, `DATABASE_URL` (both required, must differ), `BCRYPT_COST` (default 12).

Exit codes: `0` ok, `1` fatal error or failed verification (everything rolled back), `2` `--strict` and rows were rejected.

**The report and CSV contain employee PII.** They are git-ignored. Store them like any HR record and delete them after cutover.

### Suggested cutover

1. Put the legacy app in maintenance mode (no writes).
2. `npm run migrate:dry`. Review rejected rows, warnings and ambiguous dates. Fix the data in legacy if needed and repeat.
3. `npm run migrate -- --reset`. Every verification line must say PASS.
4. Give HR the `.usernames.csv`. They contact the rows with `usernameChanged = true` (new login) and `canLogIn = false` (no password: issue one). Users with `mustChangePassword = true` are prompted at their first login.

## Running it in Docker (self-hosted)

```bash
docker run --rm -it --network <compose_network> -v "$PWD":/app -w /app \
  -e LEGACY_DATABASE_URL=... -e DATABASE_URL=... node:24-alpine \
  sh -c "npm ci && npm run migrate:dry"
```

## Development

```bash
npm test          # unit tests: date parser, enum mappings, usernames, merges, password classification
npm run typecheck
```

End-to-end check against a throwaway Postgres (this is what Phase 0 was tested with):

```bash
docker run -d --name hr-mig-test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -p 55441:5432 postgres:16-alpine
docker exec hr-mig-test psql -U test -c "create database legacy" -c "create database target"
docker exec -i hr-mig-test psql -U test -d legacy < fixtures/legacy-messy.sql
(cd ../../web && DATABASE_URL=postgresql://test:test@localhost:55441/target npx prisma migrate deploy)
LEGACY_DATABASE_URL=postgresql://test:test@localhost:55441/legacy \
DATABASE_URL=postgresql://test:test@localhost:55441/target npm run migrate -- --reset
docker rm -f hr-mig-test
```

`fixtures/legacy-messy.sql` covers duplicate names, the `0` department sentinel, orphans, bad, ambiguous and en-GB dates, an existing bcrypt hash, an empty password, an unknown access value, a non-numeric person id, and shared emails.

## Why raw `pg` rather than the generated Prisma client

The script talks to both databases with `pg` and parameterised SQL. It does not use the generated v2 Prisma client:
- The legacy and v2 schemas would need two generated clients. The legacy one would also be Prisma 6.
- One explicit transaction with multi-row `INSERT … ON CONFLICT … RETURNING (xmax = 0)` gives exact inserted/updated counts and keeps legacy ids.
- It runs without `web/` installed or generated (for example from a slim container at cutover).

The cost is coupling to the v2 column names. `preflight()` checks every column the script writes before it touches anything, and fails with "run prisma migrate deploy" if the schema doesn't match.
