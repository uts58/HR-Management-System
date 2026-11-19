# Schema v2: decisions and legacy mapping

Owner: Data lead. Status: Phase 0, revised 2026-11-17 with the director's rulings on the open questions (placeholders flagged, legacy usernames kept, LeaveType enum, `users.disabled_at`, forced change for plaintext passwords).
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
| `CHECK (email_is_placeholder = (lower(email) LIKE '%@users.invalid'))` on `users` | The placeholder-email flag and the `@users.invalid` convention always agree. |
| `CHECK (end_date >= start_date)` (NULL-tolerant) on `leave_requests`; the same on `appraisals.project_start/end` | Valid ranges. NULLs are allowed for unparseable legacy dates. |
| `CHECK (rating BETWEEN 1 AND 5)` on `appraisals` | The form only offers 1–5. |
| `CHECK ((employment_status = 'TERMINATED') = (terminated_at IS NOT NULL))` | Soft-delete consistency. |
| `CHECK (NOT is_placeholder OR employment_status = 'TERMINATED')` | Placeholder employees (§6) are never active. |
| `CHECK (legacy_leave_type IS NULL OR leave_type = 'OTHER')` | The raw legacy text is kept only for rows mapped to `OTHER`. |

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
| `empleave.leaveType` (text) | **Enum `LeaveType`** (director ruling 3): `"Sick Leave"` → `SICK`, `"Annual Leave"` → `ANNUAL`, `"Casual Leave"` → `CASUAL`, `"Maternity Leave"` → `MATERNITY`, `"Unpaid Leave"` → `UNPAID`, matched **ignoring case and all whitespace**. Anything else, including `NULL`, `''` and `"sick"` without "Leave", becomes `OTHER`: the original text goes to `legacy_leave_type` (`''` for NULL), each row gets a warning, and every row is listed in `report.leaveTypeOther`. `OTHER` is for migrated data only; the UI never offers it. | `addLeave.ejs` is a fixed `<select>` with exactly those five values. | High. The Architect is updating the contract (`leaveType: LeaveType`). |
| — | `EmploymentStatus { ACTIVE, TERMINATED }` | No legacy column. Every migrated employee is `ACTIVE`, except placeholders (§6). | — |

## 5. Column mapping (every legacy column)

### `person` → `users` (Better Auth `user`) + `accounts` (Better Auth `account`, credential row)

| Legacy | v2 | Notes |
|---|---|---|
| `id` (TEXT) | `users.legacy_person_id` (unique) and `users.employee_id` (INT FK, unique) | `employee_id` is set when `person.id` parses as an integer **and** that employee exists. Otherwise `NULL` + orphan report. `users.id` is a new UUID. |
| `Name` | `users.username` (+ `display_username`) | Director ruling 2: **keep `lower(Name)`** when it matches Better Auth's default `^[a-z0-9._]{3,30}$` **and** no other person has the same name case-insensitively. Kept names are reserved first. Otherwise (`legacy-invalid`, `legacy-duplicate`, `legacy-empty`) the username is generated: `first.last` from the linked employee (ASCII-folded, `[a-z0-9.]`, max 27 + suffix), else `slug(Name)`, else `user<id>`, with short ones padded (`al` → `al.user`) and collisions getting `2`, `3`… in person-id order. `display_username` = the legacy casing when kept, else the generated name. Every person appears in `.usernames.csv` with `usernameChanged` and `usernameReason`, so HR only contacts the changed ones. |
| — | `users.name` | Employee "First Last", else `Name`, else username (Better Auth requires it). |
| — | `users.email` (unique, required) + `users.email_is_placeholder` (bool) | Better Auth requires a unique email on every account. We use the employee's email, lower-cased, if it is present, plausible and **unique case-insensitively across all employees**. Otherwise it is the **placeholder `<username>@users.invalid`** (the `.invalid` TLD is reserved by RFC 2606 and never routes; unique because usernames are) with **`email_is_placeholder = true`**. A CHECK (`users_email_placeholder_chk`) ties the flag to the domain. The app shows "no email on file" when the flag is set and must never send mail to the address. Every placeholder is listed in `report.placeholderEmails` with the reason (no employee / no email / shared / invalid). `employees.email` (contact email, optional, not unique) is unaffected. |
| `password` | `accounts.password` (`provider_id='credential'`, `account_id = user_id`) | **Stored format: bcrypt** (director decision). See §7. |
| `access` | `users.role` | §4. |
| — | `users.must_change_password` | Director ruling 6: **`true` when the legacy password was still plaintext** (it sat unhashed in the DB) or empty. `false` when it was already bcrypt. There is no opt-out flag. |
| — | `users.disabled_at` (timestamptz, nullable) | Director ruling 5: login is blocked while it's set. `terminateEmployee` sets it, and it also works for users with no employee record. The migration leaves it `NULL`; re-runs never overwrite it. Better Auth's admin-plugin `role`/`banned` fields are **not** used: our `role` column is the source of truth. |
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
| — | `is_placeholder` (bool, default false) | `true` only for placeholder rows the migration creates (§6). |

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
| `leaveType` | `leave_type` (enum) + `legacy_leave_type` (text, only for `OTHER`) | §4. |
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
| `empleave.empid` / `performance.empId` → deleted employee | **History kept** (director ruling 1: accepted). The migration creates a **placeholder employee** with the same id: **`is_placeholder = true`**, `first_name='Unknown'`, `last_name='employee #<id>'`, `TERMINATED`, `terminated_at = migration time` (the real date is unknown), no login. Reported in `report.placeholderEmployees`. This keeps `employee_id NOT NULL` + `Restrict` and matches soft-delete semantics. **Services must filter `is_placeholder = false` in employee lists (including the Terminated filter), pickers, counts (`employeeCount`, "last active HR admin") and reports.** Leave/appraisal views join them normally and show "Unknown employee #N". |
| `empleave.empid` not an integer | Row **rejected**. The full row goes to `report.rejected` so HR can fix it in legacy and re-run. |
| `person` without `employee` (or non-numeric `person.id`) | User migrated with `employee_id = NULL` + orphan report. |
| `employee` without `person` | Employee migrated with no login. Reported. |

## 7. Passwords (stored format)

- The legacy column holds a **mix**: bcrypt hashes (`$2a$`/`$2b$`, written by the Security lead's lazy upgrade-on-login) and plaintext.
- Director decision: **every migrated password is stored as bcrypt** in `accounts.password` (credential row):
  - existing bcrypt hashes are copied **unchanged** (`$2y$`/`$2x$` would be normalised to `$2b$`, which is the same algorithm);
  - remaining plaintext → `bcrypt.hash(pw, 12)` (bcryptjs, `BCRYPT_COST` env) **and `must_change_password = true`** (director ruling 6);
  - empty → no credential account; HR issues a temporary password (`resetEmployeePassword` must therefore create the account if it's missing);
  - any other recognised hash format (`$argon2…`) → copied verbatim + warning (none expected).
- New passwords set in v2 are **argon2id** (`@node-rs/argon2`). In Phase 1, Security configures Better Auth's `emailAndPassword.password.verify` to accept bcrypt **and** argon2id, and to rehash bcrypt → argon2id on a successful login.
- The verification step fails the migration if any credential password is NULL or plaintext-looking, or if a migrated password isn't bcrypt (other than verbatim copies already warned about).
- The seed also stores bcrypt, so dev environments exercise the same verify path as migrated data.

## 8. Date parsing

`scripts/migrate-legacy/src/dates.ts`. It never throws and returns `empty | ok(YYYY-MM-DD, note?) | invalid(reason)`.

- Accepted: `YYYY-MM-DD` / `YYYY/M/D` / `YYYY.MM.DD` (a time part is dropped), `YYYYMMDD`, `D Mon YYYY` / `D-Mon-YYYY` / `1st January, 1990`, `Mon D YYYY` / `January 5, 2021` / `Tue Jan 05 2021`, and `N/N/YYYY` / `N.N.YYYY` / `N-N-YYYY` (optionally `, 10:00 AM`).
- `/` dates: if one part is > 12, the order is inferred (`note: day-month-order-inferred`). Otherwise `--slash-order` applies and the value is reported as ambiguous. The default is **MDY** (director ruling 4): legacy wrote `notice.date` with `new Date().toLocaleDateString()` on the server (`routes/index.js:103`), and Node's default locale is en-US. The director is confirming this with the user against a few production values; switch to `--slash-order DMY` if they turn out day-first. `.` and `-` with the year last are treated as day-first.
- Empty: `NULL`, `''`, `'0'`, `null`, `N/A`, `-`.
- Rejected: impossible dates (`2023-02-29`), two-digit years, years outside 1900–2100, anything else. They are stored as `NULL` and reported.

## 9. Auth tables (Better Auth)

The Better Auth core schema (`user`, `session`, `account`, `verification`) plus the `username` plugin fields (`username`, `displayUsername`), with field names exactly as Better Auth expects. Only tables and columns are snake_case-mapped, so the Prisma adapter needs no `fields` remapping. HR fields on `User` (`role`, `mustChangePassword`, `employeeId`, `legacyPersonId`, `disabledAt`, `emailIsPlaceholder`) must be declared in Better Auth `user.additionalFields`. The section is marked **SECURITY reviews/owns** in the schema.

Better Auth constraints that drove decisions: `user.email` is **required and unique** (hence the placeholder emails); `user.name` is required; the password lives on `account`, not `user`; sessions are DB-backed (`sessions.token` unique).

## 10. Director rulings on the Phase 0 open questions (applied)

1. **Placeholder employees: accepted.** They are flagged with `employees.is_placeholder` (§5, §6). Services exclude them from employee lists, pickers and counts.
2. **Usernames:** the legacy login is kept, lower-cased, when it is valid and unique. Otherwise `first.last` is generated. The CSV flags who changed (§5).
3. **Leave type:** `LeaveType` enum, with `OTHER` for unmatched migrated values. The raw text is kept in `legacy_leave_type`, and every such row is reported (§4).
4. **Slash dates:** MDY stays the default (`routes/index.js:103`, en-US). The user will confirm against production values (§8).
5. **`users.disabled_at`** blocks login; `terminateEmployee` sets it. No admin-plugin `role`/`banned` (§5).
6. **Plaintext at migration time → `must_change_password = true`** by default. Users already on bcrypt aren't forced (§5, §7).
7. **Placeholder auth email:** `<username>@users.invalid` with `users.email_is_placeholder = true` and a CHECK keeping the two consistent. The app shows "no email on file" (§5).

## 11. Still open / notes for other leads

For the **Architect / Backend**:
1. Contract updates implied by the rulings: `leaveType: LeaveType` (labels for display; `OTHER` shown with `legacyLeaveType`); every employee query filters `isPlaceholder = false` except leave/appraisal joins; `terminateEmployee` sets `users.disabledAt`.
2. Map the `departments_name_lower_key` / `positions_name_lower_key` unique violation (raw P2002 on the index name) to `CONFLICT`.
3. `users.employee_id` is `Restrict` (no hard delete in v1). If hard delete is ever added, the user must be removed first.

For **Security**:
1. Configure `emailAndPassword.password.{hash,verify}`: argon2id for hash; verify accepts `$argon2id$` and `$2a$/$2b$` (bcryptjs) and rehashes on a bcrypt hit. Also `disableSignUp: true` and the username plugin with default normalisation, whose limits the migration respects.
2. `user.additionalFields`: `role` (input: false), `mustChangePassword`, `employeeId`, `legacyPersonId`, `disabledAt` (input: false), `emailIsPlaceholder` (input: false). `createLoginAccount` must set `emailIsPlaceholder = true` whenever it falls back to `<username>@users.invalid`, or the CHECK rejects the insert. Block sign-in and drop sessions when `disabledAt` is set.
3. Users with an empty legacy password get **no credential account**, so `issueTemporaryPassword` must create it when it's missing.

For **HR**: contact the `.usernames.csv` rows with `usernameChanged = true` or `canLogIn = false`.
