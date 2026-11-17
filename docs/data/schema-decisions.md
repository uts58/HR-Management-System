# Schema v2: decisions and legacy mapping

Owner: Data lead. Status: Phase 0 draft, 2026-11-17.
Files: [`web/prisma/schema.prisma`](../../web/prisma/schema.prisma), [`web/prisma/migrations/`](../../web/prisma/migrations/), [`web/prisma/seed.ts`](../../web/prisma/seed.ts), [`scripts/migrate-legacy/`](../../scripts/migrate-legacy/).
Inputs: the legacy `prisma/schema.prisma`, `routes/index.js`, `routes/hr.js`, `views/*.ejs`, the director's rulings, and the Architect's `docs/architecture/contracts.md` + ADR-0007.

## 1. Toolchain (verified, not assumed)

- **Prisma 7.10.1**, the latest stable release. npm's `latest` dist-tag currently points at `8.0.0-rc.34`, so **pin `7.10.1`**.
- Prisma 7 changes we follow (checked against the official upgrade guide and config reference):
  - Generator `provider = "prisma-client"` (Rust-free). `output` is required: `../src/generated/prisma`, so the app imports `@/generated/prisma/client`. This matches Platform's scaffold.
  - `datasource` in `schema.prisma` has only `provider`. The URL lives in Platform's `web/prisma7.config.ts` (`datasource.url`, `migrations.path`, `migrations.seed = "tsx prisma/seed.ts"`). The Prisma 7 CLI doesn't load `.env` itself, so that config imports `dotenv/config`.
  - The runtime needs a driver adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`.
  - Seeding no longer runs automatically on `migrate dev`/`reset`. Run `npm run db:seed`.
- Validated with Prisma 7.10.1: `prisma validate`, `prisma format`, `migrate dev --create-only`, `migrate deploy`, `migrate diff` (no drift, including with the hand-written SQL below), `prisma generate`, `tsc` on `seed.ts`, and `prisma db seed` run twice.

## 2. Conventions

| Topic | Decision | Why |
|---|---|---|
| Naming | Models and fields are camelCase. Tables are **plural snake_case** (`employees`, `leave_requests`), columns snake_case, all through `@map`/`@@map`. Enum types are snake_case too (`leave_status`). | Consistent naming, and it avoids reserved words: `user` and `position` are awkward unquoted in Postgres. |
| Calendar dates | `@db.Date`: DOB, leave start/end, project start/end. | ADR-0007. No time zone, so no off-by-one birthdays. |
| Instants | `@db.Timestamptz(3)`, stored in UTC. | ADR-0007 (director decision 6). |
| Timestamps | `createdAt` / `updatedAt` on every table. On `employees`, `leave_requests`, `notices` and `appraisals`, **`createdAt` is nullable**: migrated rows get `NULL` because legacy kept no timestamps (the contract read models say "null for migrated rows"). New rows always get `now()`. | Inventing a time would be worse than an honest `NULL`. Ids keep the legacy insertion order. |
| Ids | `Int @default(autoincrement())` for domain tables. Legacy ids are preserved, and the migration resets each sequence to `MAX(id)+1`. Auth tables use `String` ids, as Better Auth expects. | Director decision 4. It also removes the legacy `max(id)+1` race in the add-employee form. |
| Deletes | Employees are **soft-deleted** (`employmentStatus`, `terminatedAt`). Every FK that points at an employee is `Restrict`. Org FKs are `Restrict`. Auth child tables (`sessions`, `accounts`) `Cascade` from `users`. `leave_requests.decided_by_id` is `SetNull`. | Director decisions 2 and 3: history is never lost. |

## 3. Constraints not in `schema.prisma`

Prisma schema can't express these. They are hand-written at the end of `migrations/20261117234039_init/migration.sql`. `prisma migrate diff` confirms Prisma doesn't try to drop them.

| Constraint | Purpose |
|---|---|
| `UNIQUE (lower(name))` on `departments`, `positions` | Case-insensitive unique names (director decision 3, contract Org rule 2). There is deliberately **no** plain `@unique` on `name`. Services should catch the `departments_name_lower_key` / `positions_name_lower_key` violation and return `CONFLICT`, or check first. |
| `CHECK (username = lower(username))` on `users` | The Better Auth username plugin stores usernames normalised, so the plain unique index is case-insensitive in effect. |
| `CHECK (end_date >= start_date)` (NULL-tolerant) on `leave_requests`; the same on `appraisals.project_start/end` | Valid ranges. NULLs are allowed for unparseable legacy dates. |
| `CHECK (rating BETWEEN 1 AND 5)` on `appraisals` | The form only offers 1–5. |
| `CHECK ((employment_status = 'TERMINATED') = (terminated_at IS NOT NULL))` | Soft-delete consistency. |

## 4. Enum mappings (magic ints → enums)

Each mapping is derived from the code that writes or reads the value.

| Legacy column | Value → v2 | Evidence | Confidence |
|---|---|---|---|
| `person.access` | `1` → `HR_ADMIN`, `0` → `EMPLOYEE` | `routes/index.js` `/home`: `user.access === 1` renders the HR view. The seed uses `access: 1` for admin. | High. **Any other value** → `EMPLOYEE` + warning (none seen in code). |
| `employee.gender` | `1` → `MALE`, `0` → `FEMALE`, `NULL` → `NULL` | `addEmployee.ejs` radio `sex`: `value="1"` Male, `value="0"` Female. The detail view prints `gender==1 ? Male : Female`. | High. Other values → `NULL` + warning. Note: `parseInt(undefined)` = `NaN` could never be stored, so `NULL` only comes from manual inserts. |
| `employee.maritalStatus` (text) | `single`/`married`/`divorced` → `SINGLE`/`MARRIED`/`DIVORCED`. `'0'`, `''`, `NULL` → `NULL` | The add form's placeholder option is `value="0"`, the edit form's is `value=""`. | High. Unknown strings → `NULL` + warning. |
| `empleave.status` | `0` → `PENDING`, `1` → `APPROVED`, `2` → `REJECTED` | `viewLeave.ejs`, `viewLeavebyAdmin.ejs`; `displayLeave.ejs` links `/assignLeave?status=1\|2`. | High. **Caveat:** legacy `/assignLeave` accepted *any* integer from the URL. Unknown values → `PENDING` + warning so HR re-reviews them. |
| `empleave.read` | → `seen_by_employee`: `PENDING` → `true`; decided → `read == 1` | `/assignLeave` resets `read=0`. `/viewLeave` sets `read=1` only where `status != 0`. The contract says "always true while PENDING". | High. |
| `notice.type` | `0`/`NULL` → `GENERAL`, `1` → `URGENT`, `2` → `HOLIDAY` | `addNotice.ejs` options. `saveNotice` stores `parseInt(type) \|\| 0`. `index.ejs` highlights only `type=='1'`. | High. Others → `GENERAL` + warning. |
| `performance.rating` | `1..5` kept, otherwise `NULL` + warning | `addPerformance.ejs` select 1–5. | High. |
| `empleave.leaveType` (text) | **Kept as text** (`leave_type`). Case/spacing variants snap to the contract's `LEAVE_TYPES` labels (`"sick"` → `"Sick Leave"`). Unknown values are kept verbatim + warning. Empty → `"Unspecified"`. | `addLeave.ejs` options. The contract types `leaveType: string` "stored verbatim". | The Data lead would prefer a `LeaveType` enum, but the contract wins. See open question 6. |
| — | `EmploymentStatus { ACTIVE, TERMINATED }` | No legacy column. Every migrated employee is `ACTIVE`, except placeholders (§6). | — |

## 5. Column mapping (every legacy column)

### `person` → `users` (Better Auth `user`) + `accounts` (Better Auth `account`, credential row)

| Legacy | v2 | Notes |
|---|---|---|
| `id` (TEXT) | `users.legacy_person_id` (unique) and `users.employee_id` (INT FK, unique) | `employee_id` is set when `person.id` parses as an integer **and** that employee exists. Otherwise `NULL` + orphan report. `users.id` is a new UUID. |
| `Name` | dropped as login → `users.username` is **generated** | Director decision: stable usernames. `first.last` from the linked employee (ASCII-folded, `[a-z0-9.]`, max 27 + suffix), else `slug(Name)`, else `user<id>`. Short ones are padded (`al` → `al.user`). Collisions get `2`, `3`… in person-id order. Every result matches Better Auth's default `^[a-z0-9._]{3,30}$`. `display_username` = username. The full mapping goes into the report and `.usernames.csv`. |
| — | `users.name` | Employee "First Last", else `Name`, else username (Better Auth requires it). |
| — | `users.email` (unique, required) | The employee's email, lower-cased, if present, plausible and **unique case-insensitively across all employees**. Otherwise the placeholder `<username>@users.invalid` (RFC 2606, never deliverable), listed in `report.placeholderEmails` with the reason. |
| `password` | `accounts.password` (`provider_id='credential'`, `account_id = user_id`) | **Stored format: bcrypt** (director decision). See §7. |
| `access` | `users.role` | §4. |
| — | `users.must_change_password` | `false` for migrated users (contract Q4), `true` when the legacy password was empty. `--must-change-plaintext` forces `true` for plaintext users. |
| — | `users.email_verified` = `false`, `image` = `NULL` | Better Auth fields. |

### `employee` → `employees`

| Legacy | v2 | Notes |
|---|---|---|
| `id` | `id` | Preserved. The sequence is reset. |
| `firstName`, `middleName`, `lastName` | `first_name`, `middle_name`, `last_name` | Trimmed. `''` middle name → `NULL`. Empty first/last names are kept as `''` + warning (the columns are NOT NULL; the contract allows legacy gaps). |
| `department` (INT, no FK) | `department_id` (FK `Restrict`, nullable) | `0` (the form's "Select" sentinel) → `NULL`. A missing department → `NULL` + orphan report. A merged duplicate → remapped to the survivor. |
| `position` | `position_id` | Same as department. |
| `country`, `homeTown` | `country`, `home_town` | Verbatim (trimmed). |
| `contactNo` | `contact_no` | Verbatim. |
| `email` | `email` | Lower-cased, **not unique** (contract). Implausible values are kept + warning. |
| `gender` | `gender` (enum) | §4. |
| `maritalStatus` | `marital_status` (enum) | §4. |
| `dateofBirth` (TEXT) | `date_of_birth` (DATE) | §8. Unparseable → `NULL` + report. |
| — | `employment_status`, `terminated_at` | New (soft delete). |

### `department` / `position` → `departments` / `positions`

| Legacy | v2 | Notes |
|---|---|---|
| `id` | `id` | Preserved. |
| `departmentName` / `positionName` | `name` | Trimmed, whitespace collapsed. **Case-insensitive duplicates merge into the lowest id**, employees are reassigned, and the merge is reported. Empty → `"Department <id>"`. |

### `empleave` → `leave_requests`

| Legacy | v2 | Notes |
|---|---|---|
| `id` | `id` | Preserved. |
| `empid` (**TEXT**) | `employee_id` (INT FK `Restrict`) | Integer string → FK. Missing employee → **kept**, linked to a placeholder (§6). Non-numeric → **row rejected** (reported with the full row). |
| `leaveType` | `leave_type` (text) | §4. |
| `leaveStart`, `leaveEnd` | `start_date`, `end_date` (DATE, nullable) | §8. Unparseable/empty → `NULL` + warning (ADR-0007: keep the row). `end < start` → `end_date = NULL` + warning with the original value. |
| `description` | `reason` | Trimmed, `''` → `NULL`. |
| `status` | `status` (enum) | §4. |
| `read` | `seen_by_employee` | §4. |
| — | `decided_at`, `decided_by_id` | New audit fields. `NULL` for migrated rows (legacy didn't record them). |

### `notice` → `notices`

| Legacy | v2 | Notes |
|---|---|---|
| `id`, `title` | `id`, `title` | |
| `notice` | `body` | |
| `type` | `type` (enum) | §4. |
| `date` (TEXT, `toLocaleDateString()`) | `created_at` (timestamptz) | Parsed as a calendar date and stored at **00:00 UTC** that day. Unparseable/empty → `NULL` + warning. The contract sorts notices by `createdAt`, so the backfill matters. |

### `performance` → `appraisals`

| Legacy | v2 | Notes |
|---|---|---|
| `id` | `id` | Preserved. |
| `empId` (INT) | `employee_id` (FK `Restrict`) | Missing employee → kept + placeholder (§6). |
| `project_name` | `project_name` | |
| `project_begin`, `project_end` | `project_start`, `project_end` (DATE) | §8. `end < start` → `project_end = NULL` + warning. |
| `rating` | `rating` (SMALLINT, CHECK 1–5) | Out of range → `NULL` + warning. |

### `message` → **dropped**

The table isn't migrated (director decision). The script reports its row count.

## 6. Orphans found in legacy data and how they're handled

Legacy had no FKs, and `/hr/deleteEmployee` hard-deleted `employee` + `person` while leaving their leave/performance rows behind.

| Orphan | Handling |
|---|---|
| `employee.department/position = 0` | `NULL` (reported as "unset"). |
| `employee.department/position` → deleted row | `NULL` + orphan report. |
| `empleave.empid` / `performance.empId` → deleted employee | **History kept.** The migration creates a **placeholder employee** with the same id: `first_name='Unknown'`, `last_name='employee #<id>'`, `TERMINATED`, `terminated_at = migration time`, no login. Reported in `report.placeholderEmployees`. This keeps `employee_id NOT NULL` + `Restrict`, matches soft-delete semantics (legacy-deleted = terminated), and shows as "Unknown employee" just as the contract expects. |
| `empleave.empid` not an integer | Row **rejected**. The full row goes to `report.rejected` so HR can fix it in legacy and re-run. |
| `person` without `employee` (or non-numeric `person.id`) | User migrated with `employee_id = NULL` + orphan report. |
| `employee` without `person` | Employee migrated with no login. Reported. |

## 7. Passwords (stored format)

- The legacy column holds a **mix**: bcrypt hashes (`$2a$`/`$2b$`, written by the Security lead's lazy upgrade-on-login) and plaintext.
- Director decision: **every migrated password is stored as bcrypt** in `accounts.password` (credential row):
  - existing bcrypt hashes are copied **unchanged** (`$2y$`/`$2x$` would be normalised to `$2b$`, which is the same algorithm);
  - remaining plaintext → `bcrypt.hash(pw, 12)` (bcryptjs, `BCRYPT_COST` env);
  - empty → no credential account; HR issues a temporary password (`resetEmployeePassword` must therefore create the account if it's missing);
  - any other recognised hash format (`$argon2…`) → copied verbatim + warning (none expected).
- New passwords set in v2 are **argon2id** (`@node-rs/argon2`). In Phase 1, Security configures Better Auth's `emailAndPassword.password.verify` to accept bcrypt **and** argon2id, and to rehash bcrypt → argon2id on a successful login.
- The verification step fails the migration if any credential password is NULL or plaintext-looking, or if a migrated password isn't bcrypt (other than verbatim copies already warned about).
- The seed also stores bcrypt, so dev environments exercise the same verify path as migrated data.

## 8. Date parsing

`scripts/migrate-legacy/src/dates.ts`. It never throws and returns `empty | ok(YYYY-MM-DD, note?) | invalid(reason)`.

- Accepted: `YYYY-MM-DD` / `YYYY/M/D` / `YYYY.MM.DD` (a time part is dropped), `YYYYMMDD`, `D Mon YYYY` / `D-Mon-YYYY` / `1st January, 1990`, `Mon D YYYY` / `January 5, 2021` / `Tue Jan 05 2021`, and `N/N/YYYY` / `N.N.YYYY` / `N-N-YYYY` (optionally `, 10:00 AM`).
- `/` dates: if one part is > 12, the order is inferred (`note: day-month-order-inferred`). Otherwise `--slash-order` applies (default **MDY**, the en-US `toLocaleDateString()` that wrote `notice.date`) and the value is reported as ambiguous. `.` and `-` with the year last are treated as day-first.
- Empty: `NULL`, `''`, `'0'`, `null`, `N/A`, `-`.
- Rejected: impossible dates (`2023-02-29`), two-digit years, years outside 1900–2100, anything else. They are stored as `NULL` and reported.

## 9. Auth tables (Better Auth)

The Better Auth core schema (`user`, `session`, `account`, `verification`) plus the `username` plugin fields (`username`, `displayUsername`), with field names exactly as Better Auth expects. Only tables and columns are snake_case-mapped, so the Prisma adapter needs no `fields` remapping. HR fields on `User` (`role`, `mustChangePassword`, `employeeId`, `legacyPersonId`) must be declared in Better Auth `user.additionalFields`. The section is marked **SECURITY reviews/owns** in the schema.

Better Auth constraints that drove decisions: `user.email` is **required and unique** (hence the placeholder emails); `user.name` is required; the password lives on `account`, not `user`; sessions are DB-backed (`sessions.token` unique).

## 10. Open questions

For the **Architect**:
1. **Placeholder employees for orphaned history** (§6): is "Unknown / employee #N, TERMINATED" acceptable in `listEmployees({status:'TERMINATED'})`? Alternatively, a nullable `employee_id`, which weakens the model forever. My recommendation: keep the placeholders.
2. **Terminated placeholder `terminated_at`** is the migration time, because the real deletion date is unknown. Should it be shown as "unknown" instead? (That would need the CHECK relaxed for placeholders, or a flag.)
3. **Username change for everyone:** every migrated user gets `first.last` (e.g. legacy `admin` → `admin.user`). Alternatively, keep `lower(person.Name)` when it is unique and valid, and fall back to `first.last` only on collision. That's fewer surprises for users, but still unstable names. I implemented `first.last` per the director's wording.
4. Service code must map the `lower(name)` unique violation to `CONFLICT` (there is no Prisma-level `@unique` on `name`, so it shows up as a raw P2002 on the index name).
5. `users.employee_id` is `Restrict` (no hard delete in v1). If hard delete is ever added, the user must be removed first.
6. `leave_type` as free text versus an enum with `OTHER` + raw text: I'd prefer the enum for reporting and data quality. The contract currently says verbatim strings.

For **Security**:
1. Configure `emailAndPassword.password.{hash,verify}`: argon2id for hash; verify accepts `$argon2id$` and `$2a$/$2b$` (bcrypt via bcryptjs), and rehashes on a bcrypt hit. Also `disableSignUp: true` and the username plugin with default normalisation (lower-case), whose limits (3–30, `[a-z0-9._]`) the migration already respects.
2. `user.additionalFields` for `role` (input: false), `mustChangePassword`, `employeeId`, `legacyPersonId`. If you adopt Better Auth's **admin plugin**, its own `role` (string) and `banned` fields clash with our `Role` enum column. Tell me and I'll adapt.
3. `disableLogin` (termination): the schema has no `banned` flag. Contract rule 1c checks employee `TERMINATED` at sign-in/session time. Is that enough, or do you want a `banned`/`disabledAt` column on `users`?
4. Users with an empty legacy password get **no credential account**. `issueTemporaryPassword` must create it when it's missing.
5. Should migrated plaintext users be forced to change their password (`--must-change-plaintext`)? Legacy auto-generated 8-character passwords that nobody saw, so most real users either chose their own password or never logged in.

For the **Director / HR**:
1. Confirm `--slash-order` (MDY) by looking at a few production `notice.date` values. If the legacy server locale was en-GB, use `DMY`.
2. HR must hand out the new usernames (from the `.usernames.csv`).
