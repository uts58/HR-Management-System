# Schema: decisions

Owner: Data lead. Revised 2026-11-21 for launch: the app is a new product with no legacy data to import, so everything that existed only for a data migration (placeholder employees, legacy ids, `OTHER` leave, bcrypt passwords, the migration script) is gone.
Files: [`web/prisma/schema.prisma`](../../web/prisma/schema.prisma), [`web/prisma/migrations/`](../../web/prisma/migrations/) (a single init migration), [`web/prisma/seed.ts`](../../web/prisma/seed.ts).
Inputs: the legacy app (as a functional spec only), the director's rulings, and the Architect's `docs/architecture/contracts.md` + ADR-0007.

## 1. Toolchain (verified, not assumed)

- **Prisma 7.10.1**, the latest stable release. npm's `latest` dist-tag currently points at `8.0.0-rc.34`, so **pin `7.10.1`**.
- Prisma 7 changes we follow (checked against the official upgrade guide and config reference):
  - Generator `provider = "prisma-client"` (Rust-free). `output` is required: `../src/generated/prisma`, so the app imports `@/generated/prisma/client`. This matches Platform's scaffold.
  - `datasource` in `schema.prisma` has only `provider`. The URL lives in Platform's `web/prisma7.config.ts` (`datasource.url`, `migrations.path`, `migrations.seed = "tsx prisma/seed.ts"`). The Prisma 7 CLI doesn't load `.env` itself, so that config imports `dotenv/config`.
  - The runtime needs a driver adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
  - Seeding no longer runs automatically on `migrate dev`/`reset`. Run `npm run db:seed`.
- Validated with Prisma 7.10.1: `prisma validate`, `migrate deploy`, `migrate diff` (no drift, including with the hand-written SQL below), `prisma generate`, and `prisma db seed` run twice.

## 2. Conventions

| Topic | Decision | Why |
|---|---|---|
| Naming | Models and fields are camelCase. Tables are **plural snake_case** (`employees`, `leave_requests`), columns snake_case, all through `@map`/`@@map`. Enum types are snake_case too (`leave_status`). | Consistent naming, and it avoids reserved words: `user` and `position` are awkward unquoted in Postgres. |
| Calendar dates | `@db.Date`: DOB, leave start/end, project start/end. | ADR-0007. No time zone, so no off-by-one birthdays. |
| Instants | `@db.Timestamptz(3)`, stored in UTC. | ADR-0007 (director decision 6). |
| Timestamps | `createdAt` / `updatedAt` on every table. New rows always get `now()`. | |
| Ids | `Int @default(autoincrement())` for domain tables; the database assigns them. Auth tables use `String` ids, as Better Auth expects. | Removes the legacy `max(id)+1` race in the add-employee form. |
| Deletes | Employees are **soft-deleted** (`employmentStatus`, `terminatedAt`). Every FK that points at an employee is `Restrict`. Org FKs are `Restrict`. Auth child tables (`sessions`, `accounts`) `Cascade` from `users`. `leave_requests.decided_by_id` is `SetNull`. | Director decisions 2 and 3: history is never lost. |

## 3. Constraints not in `schema.prisma`

Prisma schema can't express these. They are hand-written at the end of `migrations/20261121000000_init/migration.sql`. `prisma migrate diff` confirms Prisma doesn't try to drop them.

| Constraint | Purpose |
|---|---|
| `UNIQUE (lower(name))` on `departments`, `positions` | Case-insensitive unique names (director decision 3, contract Org rule 2). There is deliberately **no** plain `@unique` on `name`. Services catch the `departments_name_lower_key` / `positions_name_lower_key` violation and return `CONFLICT`. |
| `CHECK (username = lower(username))` on `users` | The Better Auth username plugin stores usernames normalised, so the plain unique index is case-insensitive in effect. |
| `CHECK (email_is_placeholder = (lower(email) LIKE '%@users.invalid'))` on `users` | The placeholder-email flag and the `@users.invalid` convention always agree (§4). |
| `CHECK (end_date >= start_date)` (NULL-tolerant) on `leave_requests`; the same on `appraisals.project_start/end` | Valid ranges. |
| `CHECK (rating BETWEEN 1 AND 5)` on `appraisals` | The form only offers 1–5. |
| `CHECK ((employment_status = 'TERMINATED') = (terminated_at IS NOT NULL))` | Soft-delete consistency. |

## 4. Enums and notable columns

| Item | Decision |
|---|---|
| `Role` | `HR_ADMIN`, `EMPLOYEE`. Our `users.role` column is the source of truth; Better Auth's admin-plugin `role`/`banned` fields are **not** used. The first HR admin comes from `npm run create-admin` (web/README.md). |
| `LeaveType` | `SICK`, `ANNUAL`, `CASUAL`, `MATERNITY`, `UNPAID` (the legacy form's five options). |
| `LeaveStatus` | `PENDING`, `APPROVED`, `REJECTED`. `seen_by_employee` is false while HR has decided and the employee hasn't looked yet. |
| `NoticeType` | `GENERAL`, `URGENT`, `HOLIDAY`. |
| `EmploymentStatus` | `ACTIVE`, `TERMINATED` (soft delete). |
| `users.email` + `users.email_is_placeholder` | Better Auth requires a unique email on every account, but `employees.email` is optional and not unique. The login email is the employee's email, lower-cased, when it is present, plausible and not used by another account. Otherwise it is **`<username>@users.invalid`** (RFC 2606, never routes; unique because usernames are) with `email_is_placeholder = true`. The app shows "No email on file" and never sends mail to it. |
| `users.must_change_password` | `true` while the user holds an HR-issued temporary password (account creation, password reset). Cleared by `changePassword`. `create-admin` sets a known password, so it leaves this `false`. |
| `users.disabled_at` | Login is blocked while it's set (director ruling 5). `terminateEmployee` sets it; it also works for users with no employee record. |
| `accounts.password` | argon2id only (`@node-rs/argon2`), on the `provider_id = 'credential'` row with `account_id = user_id`. The seed and test fixtures use argon2id too. |

## 5. Auth tables (Better Auth)

The Better Auth core schema (`user`, `session`, `account`, `verification`) plus the `username` plugin fields (`username`, `displayUsername`), with field names exactly as Better Auth expects. Only tables and columns are snake_case-mapped, so the Prisma adapter needs no `fields` remapping. HR fields on `User` (`role`, `mustChangePassword`, `employeeId`, `disabledAt`, `emailIsPlaceholder`) are declared in Better Auth `user.additionalFields`, all `input: false`. The section is marked **SECURITY reviews/owns** in the schema.

Better Auth constraints that drove decisions: `user.email` is **required and unique** (hence the placeholder emails); `user.name` is required; the password lives on `account`, not `user`; sessions are DB-backed (`sessions.token` unique).

## 6. Notes for other leads

1. `users.employee_id` is `Restrict` (no hard delete in v1). If hard delete is ever added, the user must be removed first.
2. Some read-model columns are still nullable (`createdAt`, leave dates, appraisal project fields). Nothing writes NULL into them today; tightening them to NOT NULL is a separate change.
