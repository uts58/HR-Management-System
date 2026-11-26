# Service contracts

Owner: Tech Lead. Status: Phase 0, revised 2026-11-17 with the director's rulings (Better Auth, soft delete, notices behind login, reset password approved).
TypeScript source of truth: [`web/src/contracts/`](../../web/src/contracts/). If this document and the `.ts` files disagree, the `.ts` files win and this document gets fixed.

## Conventions (all domains)

- Every service function is `fn(actor: Actor, ...args)`. No service is callable anonymously. `Actor = { userId, employeeId | null, role }` comes from the session (ADR-0003).
- "Role" below is the role the **service** enforces. The calling action enforces it too, with `requireRole` (ADR-0004).
- Services throw `ServiceError` with the listed codes. Actions return `ActionResult<T>` (ADR-0006). `UNAUTHENTICATED`/`INTERNAL` can come from any action and aren't repeated below.
- Calendar dates are `IsoDate` (`YYYY-MM-DD`, never converted). Instants are `UtcTimestamp` in every read model (ISO-8601 UTC strings ending in `Z`, never `Date`; services convert at the Prisma boundary), stored as UTC, and rendered in the viewer's browser time zone. There is no company time zone and no `APP_TIME_ZONE` (ADR-0007; this user decision of 2026-11-18 reverses the earlier director ruling).
- String inputs are trimmed. Empty optional strings become `null`.
- Some read-model fields are typed nullable (e.g. `createdAt`, leave dates) because the columns are nullable; new rows always have them.
- Legend: **[CHANGE]** = intentional change from legacy, **[NEW]** = no legacy equivalent (director-approved where listed).

---

## Auth

Implemented by Security in `web/src/auth/` on **Better Auth** (Prisma adapter, database sessions, `username` plugin, `nextCookies`). Types: `contracts/auth.ts`. Nothing outside `web/src/auth/` imports `better-auth` (ADR-0004).

### Auth API (called by every action/page)

| Function | Returns | Behaviour |
|---|---|---|
| `getSession()` | `Promise<Session \| null>` | Never throws. Reads the DB-backed session (cookie cache off) with the current role and employee status, once per request. Null if expired/revoked, user gone, or employee TERMINATED. |
| `requireSession(opts?)` | `Promise<Session>` | Any signed-in user. `onFail: 'throw'` (default) throws `AuthError('UNAUTHENTICATED')`. `'redirect'` sends to `/login?callbackUrl=…`. |
| `requireRole(role \| roles, opts?)` | `Promise<Session>` | As above, plus `AuthError('FORBIDDEN')` / the 403 page when the role doesn't match. Both also enforce `mustChangePassword` (redirect to `/change-password` / `FORBIDDEN`) unless `allowPendingPasswordChange`. |
| `Role` | `'HR_ADMIN' \| 'EMPLOYEE'` | Legacy `person.access` 1 / 0. |

`SessionUser = { userId, employeeId | null, username, displayName, role, mustChangePassword }`.

**Auth seam (Backend ↔ Security, director ruling):**
- Backend never imports `@/auth` directly. `web/src/server/auth-seam.ts` re-exports `requireRole` and `requireSession` from `@/auth`, and `defineAction` and services use only the seam, so tests can mock it.
- **Failure contract:** in throw mode, auth failures throw an `Error` with `name === "AuthError"` and `code` either `"UNAUTHENTICATED"` (no valid session, or the user is disabled or terminated) or `"FORBIDDEN"` (wrong role). `runAction` maps both to `ActionResult` (ADR-0006).
- **Pending password change:** a user with `mustChangePassword = true` gets `FORBIDDEN` from every action unless that action sets `allowPendingPasswordChange` (only `changePassword` does; `signOut` is `"PUBLIC"`).
- `defineAction` roles: a `Role`, a list of roles, `"ANY"` (signed in), or `"PUBLIC"` (only allowed under `web/src/auth/`, lint-enforced; used for `signOut`).

**Where actions live:** `web/src/server/actions/<area>.ts` (Backend; one `'use server'` file per area, `defineAction` exports only) and `web/src/auth/actions.ts` (Security). Action names match the service function, e.g. `decideLeaveRequest({ id, decision })` and `markMyLeaveDecisionsSeen()`. Pages use the helpers in `web/src/server/page.ts`: `orNotFound(promise)` (service `NOT_FOUND` → `notFound()`) and `idOrNotFound(param)` (parse a route id or `notFound()`). Mutations revalidate the `(app)` layout (accepted for v1).

**Action input convention:** an action that targets one record with fields takes `{ id, ...fields }`, validated by `<action>ActionSchema` (e.g. `updateEmployeeActionSchema`). It calls the service as `fn(actor, id, fields)`. Id-only actions take `{ id }` (ADR-0002).

### Account administration (`AccountAdminApi`, server-only, called by Backend's employee service)

| Function | Behaviour |
|---|---|
| `createLoginAccount(tx, { employeeId, username, displayName, email?, role })` | Creates the Better Auth `user` + credential `account` inside the caller's transaction, with a random temporary password (≥12 chars) and `mustChangePassword = true`. If no usable email is supplied (missing or already taken), it uses `<username>@users.invalid` **and sets `emailIsPlaceholder = true`**; a DB CHECK rejects a placeholder address without the flag. Returns `{ userId, credentials }`. `CONFLICT` on a taken username. |
| `issueTemporaryPassword(tx, userId)` | New temporary password, `mustChangePassword = true`, all sessions revoked. `NOT_FOUND` if the user or its credential account is missing. |
| `updateDisplayName(tx, userId, name)` | Sets the user's display name (`user.name`). `updateEmployee` calls it in the same transaction when HR renames an employee (director ruling, Backend Phase 1b). Never changes the username. |
| `disableLogin(tx, userId)` | Sets `users.disabledAt = now`, which blocks sign-in and `getSession()`, and deletes all of the user's sessions (termination). Our `role` column is the source of truth; Better Auth's admin-plugin `role`/`banned` fields are not used. |

**`user.additionalFields`** (Data schema, Security config; type `AuthUserAdditionalFields`). **All five are `input: false`**: no Better Auth endpoint can set them from a request. Only `AccountAdminApi` (and the `create-admin` CLI) write them.

| Field | Notes |
|---|---|
| `role` | Source of truth for authorization. |
| `mustChangePassword` | Set by account creation and password reset (HR-issued temporary password). Cleared by `changePassword`. |
| `employeeId` | Unique FK to `employee`, `Restrict`. |
| `disabledAt` | When set, sign-in is blocked and sessions are dropped. |
| `emailIsPlaceholder` | True for `@users.invalid` addresses. |

**Auth implementation decisions (Security Phase 1; detail in ADR-0004):**
- **Module surface:** `@/auth` (server-only: `getSession`, `requireSession`, `requireRole`, `AccountAdminApi`), `@/auth/actions` (`changePassword`, `signOut`), `@/auth/client` (browser sign-in only), `@/auth/paths` (route constants). Nothing else in `web/src/auth/` is importable from outside it.
- **HTTP surface is allowlisted:** `/api/auth/sign-in/username`, `/sign-out`, `/get-session`, `/ok`, `/error`. Every other Better Auth path returns 404.
- **Forced password change:** sign-in sets an `hr.must_change_password` hint cookie, and the proxy redirects page loads to `/change-password` while it's present. The **authoritative** check is server-side in `requireSession`/`requireRole`: pages redirect and actions get `FORBIDDEN`, unless they set `allowPendingPasswordChange`.
- **Role failures:** pages redirect to `/forbidden` (no experimental `authInterrupts`); actions return `FORBIDDEN` via `defineAction`.
- **Rate limits:** about 50 requests per 60 s per IP, plus 10 failed sign-ins per 60 s per username+IP (legacy parity). In memory, single instance in v1.
- **Backlog:** breached-password check on new passwords.

### Sign-in, sign-out, change password

| Function | Where | Role | Input | Output | Errors |
|---|---|---|---|---|---|
| `signInWithUsername` (`AuthClientApi`) | browser → `POST /api/auth/sign-in/username` | anonymous | `{ username, password }` | `ActionResult<{ redirectTo }>` | `VALIDATION` (generic "Invalid username or password"), rate-limited (HTTP 429 → "Too many attempts") |
| `signOut` (`AuthActions`) | server action, `defineAction({ role: "PUBLIC" })` (idempotent) | any, including no session | – | `void` | – |
| `changePassword` (`AuthActions`) | server action | any signed-in (also while `mustChangePassword`) | `{ currentPassword, newPassword, confirmPassword }` | `ActionResult` | `VALIDATION` (wrong current password → field `currentPassword`; mismatch → `confirmPassword`; policy → `newPassword`) |

### Business rules

1. Username matching is case-insensitive (legacy parity: `mode: 'insensitive'`; the Better Auth `username` plugin lower-cases by default).
1a. **Sign-in is not a server action.** Better Auth's rate limiter only covers HTTP requests to `/api/auth/*`; server-side `auth.api` calls are not limited. The form calls the endpoint from the browser (`@/auth/client`), with the limits listed above.
1b. Public sign-up is disabled (`emailAndPassword.disableSignUp: true`). Only HR creates accounts.
1c. TERMINATED employees can't sign in, and their sessions are revoked at termination. The mechanism is `users.disabledAt` (set by `disableLogin`): any user with it set gets the generic login failure, and `getSession()` returns null.
1d. **First HR admin:** `npm run create-admin` (in `web/`) creates an ACTIVE employee plus an `HR_ADMIN` login with an operator-chosen password (policy-checked, no forced change). It is idempotent and never promotes an existing non-admin account.
2. Login failures always give the same message, whether or not the user exists.
3. After sign-in, everyone lands on `/dashboard` (legacy `/home`), or on `callbackUrl` if it's same-origin.
4. While `mustChangePassword` is true, only `/change-password`, `changePassword` and `signOut` are allowed. `changePassword` revokes the user's other sessions.
5. Password policy (Security sets the final numbers): minimum 8 characters, not equal to the username, not equal to the current password.

### Behaviour changes

- **[CHANGE]** Login uses a stable `username`, no longer the employee's first name (`person.Name`). Legacy renamed the login when HR edited the first name, and two employees with the same first name collided.
- **[CHANGE]** Passwords are hashed with argon2id (`@node-rs/argon2`). Only argon2id hashes are accepted (ADR-0004 rule 7).
- **[CHANGE]** Roles are enforced on every route. Legacy checked only "logged in".
- **[CHANGE]** Logout is a POST action. Legacy used `GET /logout`.

---

## Employee

Implemented by Backend in `web/src/server/employee/`. Types: `contracts/employee.ts`.

| Function | Role | Input → Output | Errors |
|---|---|---|---|
| `listEmployees(actor, { status? })` | HR_ADMIN | → `EmployeeListItem[]` (id asc; default ACTIVE only, `TERMINATED` or `ALL` on request) | `FORBIDDEN` |
| `listEmployeeOptions(actor)` | HR_ADMIN | → `Option<EmployeeId>[]` (ACTIVE only, first name asc) | `FORBIDDEN` |
| `getEmployee(actor, id)` | HR_ADMIN any (incl. TERMINATED); EMPLOYEE own only | → `EmployeeDetail` | `NOT_FOUND` (also for someone else's id) |
| `getMyProfile(actor)` | any | → `EmployeeDetail` | `NOT_FOUND` (account has no employee record) |
| `getEmployeeFormOptions(actor)` | HR_ADMIN | → `EmployeeFormOptions` | `FORBIDDEN` |
| `createEmployee(actor, CreateEmployeeInput)` | HR_ADMIN | → `CreateEmployeeResult { employee, credentials }` | `VALIDATION`, `CONFLICT` (username, employee number) |
| `updateEmployee(actor, id, UpdateEmployeeInput)` | HR_ADMIN | → `EmployeeDetail` | `NOT_FOUND`, `VALIDATION`, `CONFLICT` (terminated, employee number) |
| `terminateEmployee(actor, id)` **[CHANGE]** | HR_ADMIN | → `EmployeeDetail` | `NOT_FOUND`, `CONFLICT` (self / last active HR admin / already terminated) |
| `resetEmployeePassword(actor, id)` **[NEW, approved]** | HR_ADMIN | → `IssuedCredentials` | `NOT_FOUND`, `CONFLICT` (terminated) |

### Field rules (`CreateEmployeeInput` / `UpdateEmployeeInput`)

The legacy form said "All fields are mandatory except Middle name". We now enforce that on the server.

| Field | Rule | Legacy |
|---|---|---|
| firstName, lastName | required, 1–100 | client-only check |
| middleName | optional, ≤100 | – |
| departmentId, positionId | required, must exist | `"0"` sentinel, not checked on the server |
| employmentType | required, one of `EMPLOYMENT_TYPES` (`FULL_TIME` \| `PART_TIME` \| `CONTRACTOR`); the form preselects `FULL_TIME`, which is also the DB default | – |
| hireDate | optional `IsoDate` (1900–2100, future allowed); blank is null | – |
| employeeNumber | optional, trimmed, ≤50, blank is null. Unique when set: a duplicate is `CONFLICT` on `employeeNumber` | – |
| country | one of `COUNTRIES` (8 values) | same list, not required on the client |
| homeTown | required, 1–100 | client-only |
| contactNo | required, 5–20 chars of `0-9 + - ( ) space` | digits only, enforced by keypress filter |
| email | required, valid, ≤254, stored lower-case. **Not** unique. | client regex |
| gender | optional: `MALE` \| `FEMALE` \| `NON_BINARY` \| `PREFER_NOT_TO_SAY`; blank is null | `1` / `0`, default male |
| maritalStatus | `SINGLE` \| `MARRIED` \| `DIVORCED` | lower-case strings, `"0"` if not chosen |
| dateOfBirth | `IsoDate`, in the past. The server accepts dates up to the UTC date + 1 day, because the viewer's time zone is unknown (ADR-0007 rule 4); the client form checks against the browser's local date. | free text "01 Jan 2019" |
| username (create only) | optional, `USERNAME_PATTERN` (3–30 chars of `[a-z0-9._]`), unique (case-insensitive). Default `first.last`, with `2`, `3`… added if taken. | `person.Name = firstName` |

### Business rules

1. **Employee ID generation [CHANGE]:** the database assigns ids (identity/sequence). Legacy computed `max(id)+1` when the form loaded and trusted the read-only field the browser sent back, which races when two HR users add employees at once.
2. **Create** inserts an `ACTIVE` employee and its login account through `AccountAdminApi.createLoginAccount(tx, …)` (role `EMPLOYEE`, random temporary password of at least 12 characters, `mustChangePassword = true`) in **one transaction**. The plain temporary password is returned once in `credentials` and shown to HR on the success screen. It is never logged or stored in plain text. **[CHANGE]** Legacy generated an 8-character random password that nobody could ever see, so new employees could not log in.
3. New accounts are always `EMPLOYEE` (parity: there is no UI to create HR admins. The seed and `npm run create-admin` create them).
4. **Update** does not touch the username or the role. **[CHANGE]** Legacy set `person.Name` to the new first name, which changed the login name. When the name changes and the employee has an account, the linked user's **display name** follows: `AccountAdminApi.updateDisplayName`, called in the same transaction.
5. **Termination replaces delete [CHANGE, director ruling].** Employees have `status: ACTIVE | TERMINATED` and `terminatedAt`. `terminateEmployee` runs in one transaction: sets `status = TERMINATED` and `terminatedAt = now`, calls `AccountAdminApi.disableLogin`, which sets `users.disabledAt` (no sign-in, all sessions revoked), and sets the employee's `PENDING` leave requests to `REJECTED` (`decidedBy = actor`). Leave and appraisal history is **kept**. Blocked with `CONFLICT` for yourself, the last active `HR_ADMIN`, or someone already terminated. There is **no hard delete in v1** and no reinstatement. Legacy hard-deleted `employee` + `person` and left leave/performance rows pointing at nothing.
6. **Listing [CHANGE]:** by default shows ACTIVE employees only, the HR admin included, with a role badge, plus a filter for Terminated/All. Legacy hid `id == 1` by hard-coding it.
6a. Terminated employees can't be edited or have their password reset, and don't appear in pickers (appraisals). Their usernames stay reserved. In leave and appraisal lists they appear with a "Terminated" marker (`employee.status` on `EmployeeRef`).
6c. **Usernames:** new accounts must match `USERNAME_PATTERN` (3–30 chars of `[a-z0-9._]`, the Better Auth username plugin default). The default is `first.last` (plus a number if taken).
6d. **Placeholder login email:** `EmployeeDetail.emailIsPlaceholder` mirrors `users.emailIsPlaceholder`. When it's true, the profile shows "No email on file" instead of the `@users.invalid` address. The address itself never appears in the UI.
7. **Visibility:** EMPLOYEE can only see their own record through `getMyProfile`/`getEmployee(own id)`. **[CHANGE]** In legacy any logged-in user could open `/hr/viewDetails?id=N` for anyone.
8. HR's own "View Profile" uses `getMyProfile` (legacy linked to `viewDetails?id=<own id>`).

---

## Org

Departments and positions. Implemented by Backend in `web/src/server/org/`. Types: `contracts/org.ts`.

| Function | Role | Input → Output | Errors |
|---|---|---|---|
| `listDepartments(actor)` | HR_ADMIN | → `Department[]` (id asc, with `employeeCount` active and `totalEmployeeCount`) | `FORBIDDEN` |
| `createDepartment(actor, { name })` | HR_ADMIN | → `Department` | `VALIDATION`, `CONFLICT` |
| `deleteDepartment(actor, id)` | HR_ADMIN | → `void` | `NOT_FOUND`, `CONFLICT` |
| `listPositions(actor)` | HR_ADMIN | → `Position[]` (id asc, with `employeeCount` active and `totalEmployeeCount`) | `FORBIDDEN` |
| `createPosition(actor, { name })` | HR_ADMIN | → `Position` | `VALIDATION`, `CONFLICT` |
| `deletePosition(actor, id)` | HR_ADMIN | → `void` | `NOT_FOUND`, `CONFLICT` |

### Business rules

1. Name is trimmed, 1–100 characters, required (parity: legacy rejected blank names with "Name required").
2. **[CHANGE]** Names are unique case-insensitive within their table → `CONFLICT` "A department with this name already exists" on field `name`. Legacy allowed duplicates. Data enforces this with a hand-written unique index on `lower(name)`. Prisma's error for that index may not name the field, so the service checks first, and also catches the unique violation from the insert (a race) and maps it to the same `CONFLICT`.
3. **Deleting a department or position that employees use [CHANGE]:** rejected with `CONFLICT` "N employees are assigned to this department. Reassign them first." Terminated employees count, because their records keep the reference. The UI disables the delete button when `totalEmployeeCount > 0`. The service checks first, and also catches a foreign-key violation (P2003) from the delete and converts it to the same `CONFLICT`. Globally, P2003 stays `INTERNAL` (ADR-0006). Legacy deleted the row (no foreign key), and those employees then showed an empty position/department everywhere.
4. Rename is not supported (parity).

---

## Leave

Implemented by Backend in `web/src/server/leave/`. Types: `contracts/leave.ts`.

| Function | Role | Input → Output | Errors |
|---|---|---|---|
| `applyForLeave(actor, ApplyForLeaveInput)` | EMPLOYEE, HR_ADMIN | → `LeaveRequest` | `VALIDATION`, `FORBIDDEN` |
| `listMyLeaveRequests(actor)` | EMPLOYEE, HR_ADMIN | → `LeaveRequest[]` (newest first) | `FORBIDDEN` |
| `markMyLeaveDecisionsSeen(actor)` | EMPLOYEE, HR_ADMIN | → `number` (rows changed) | `FORBIDDEN` |
| `countMyUnseenDecisions(actor)` | EMPLOYEE, HR_ADMIN | → `number` | `FORBIDDEN` |
| `listPendingLeaveRequests(actor)` | HR_ADMIN | → `LeaveRequest[]` (oldest first) | `FORBIDDEN` |
| `listAllLeaveRequests(actor)` | HR_ADMIN | → `LeaveRequest[]` (newest first) | `FORBIDDEN` |
| `countPendingLeaveRequests(actor)` | HR_ADMIN | → `number` | `FORBIDDEN` |
| `decideLeaveRequest(actor, id, 'APPROVED' \| 'REJECTED')` | HR_ADMIN | → `LeaveRequest` | `NOT_FOUND`, `CONFLICT`, `FORBIDDEN` (own request, rule 7a) |
| `canDecideOwnLeave(actor)` | HR_ADMIN | → `boolean` (actor is the only active HR admin) | `FORBIDDEN` |

### State machine

```
            applyForLeave
                 │
                 ▼
            ┌─────────┐  decideLeaveRequest(APPROVED)  ┌──────────┐
            │ PENDING │ ─────────────────────────────▶ │ APPROVED │
            └─────────┘                                └──────────┘
                 │       decideLeaveRequest(REJECTED)  ┌──────────┐
                 └───────────────────────────────────▶ │ REJECTED │
                                                       └──────────┘
```

Legacy integers: 0 = PENDING, 1 = APPROVED, 2 = REJECTED.

### Business rules

1. `leaveType` is an enum (director ruling): `SICK | ANNUAL | CASUAL | MATERNITY | UNPAID` (`LEAVE_TYPES`), with display labels matching the legacy text (`LEAVE_TYPE_LABELS`). `startDate`/`endDate` are `IsoDate`, `endDate ≥ startDate`. `reason` is optional, ≤1000. Past dates are allowed (e.g. sick leave logged afterwards).
2. New requests are always `PENDING` for `actor.employeeId`. The employee id is never read from input.
3. **[CHANGE]** Only `PENDING` requests can be decided. Deciding again gives `CONFLICT`. Legacy `GET /assignLeave?id=&status=` accepted any integer status at any time, from any logged-in user.
4. A decision sets `decidedAt = now`, `decidedBy = actor.userId` **[NEW, audit]**, `seenByEmployee = false`, and `selfApproved` (true only for a self-decision under rule 7a).
5. **Notification (legacy `read` flag):** the employee dashboard shows "Your leave request has been reviewed (N)" when `countMyUnseenDecisions > 0`. Opening leave history shows the list, and the page then calls `markMyLeaveDecisionsSeen`. **[CHANGE]** Legacy did that update inside the GET handler. We keep reads free of side effects so link prefetching can't mark items as seen.
6. HR dashboard shows "Pending leave requests (N)" linking to the approval queue. **[CHANGE / bug fix]** Legacy compared `title == 'in'`, which is never true, so HR never saw the count and saw the employee message instead.
7. No balance tracking, no overlap check, no cancellation (none exist in legacy).
7a. **[CHANGE, founder ruling, #27]** HR admins can apply for leave and see their own history, like employees. Nobody decides their own request: `decideLeaveRequest` on a request whose employee is `actor.employeeId` is `FORBIDDEN`. Exception: when the actor is the only active HR admin (no other `HR_ADMIN` login that is enabled and whose employee, if any, is not terminated), they may decide it, and the decision is stored with `selfApproved = true` and shown as "Self-approved"/"Self-rejected" wherever the decision appears. The admin count is read inside the decision transaction under the same advisory lock that `terminateEmployee` and `create-admin` take, so it can't change before the decision commits. The UI shows no decide buttons on a request the viewer may not decide. The audit log (#29) will record self-decisions.
7b. Terminating an employee rejects their PENDING requests (Employee rule 5). Their decided history stays visible to HR.

---

## Notice

Implemented by Backend in `web/src/server/notice/`. Types: `contracts/notice.ts`.

| Function | Role | Input → Output | Errors |
|---|---|---|---|
| `listRecentNotices(actor, limit = 5)` | any | → `Notice[]` (newest first) | – |
| `listNotices(actor)` | HR_ADMIN | → `Notice[]` (newest first) | `FORBIDDEN` |
| `createNotice(actor, CreateNoticeInput)` | HR_ADMIN | → `Notice` | `VALIDATION` |
| `deleteNotice(actor, id)` | HR_ADMIN | → `void` | `NOT_FOUND` |

### Business rules

1. `title` 1–200, `body` 1–5000 (both required **[CHANGE]**: legacy stored empty strings), `type` ∈ `GENERAL | URGENT | HOLIDAY` (legacy 0/1/2).
2. `createdAt` is set by the database. **[CHANGE]** Legacy stored the server's `toLocaleDateString()` text.
3. The dashboard shows the 5 newest. Urgent notices are visually highlighted (legacy highlighted `type == 1`).
4. **[CHANGE, director ruling] Notices are behind login.** Legacy showed them on the public login page. They're internal information, so the login page shows no notices and no service returns notices to anonymous callers.
5. Edit is not supported (parity).

---

## Performance

Implemented by Backend in `web/src/server/performance/`. Types: `contracts/performance.ts`.

| Function | Role | Input → Output | Errors |
|---|---|---|---|
| `listAppraisals(actor)` | HR_ADMIN | → `Appraisal[]` (newest first) | `FORBIDDEN` |
| `createAppraisal(actor, CreateAppraisalInput)` | HR_ADMIN | → `Appraisal` | `VALIDATION` |
| `deleteAppraisal(actor, id)` | HR_ADMIN | → `void` | `NOT_FOUND` |

### Business rules

1. `employeeId` is required and must be an existing ACTIVE employee (`VALIDATION` on field `employeeId`). **[CHANGE]** Legacy accepted an empty selection, which failed silently.
2. `projectName` 1–200 required, `projectStart`/`projectEnd` `IsoDate` with end ≥ start, `rating` ∈ 1..5 (labels Poor … Excellent, default 3 in the form). **[CHANGE]** Legacy had free-text dates and no server checks.
3. Employees cannot see their own appraisals (parity; there was no such page).
4. Appraisals of terminated employees are kept and listed with a "Terminated" marker (see Employee rule 5).

---

## Dropped

- `Message` model and table: unused, dropped (director decision).

---

## Data model (resolved)

The schema and its rationale are in `docs/data/schema-decisions.md`. In short: Better Auth tables (`user`, `session`, `account`, `verification`, username plugin, no admin plugin) with `user.additionalFields` `role`, `mustChangePassword`, `disabledAt`, `employeeId` (nullable unique FK) and `emailIsPlaceholder`; argon2id passwords on the credential `account`; enums for role, gender, marital status, employment status, leave type/status and notice type; `Restrict` FKs to employees (soft delete only); case-insensitive unique department/position names via a hand-written index. No legacy data is migrated.

## Open questions for other leads

- **Security:** Better Auth config per ADR-0004. Implement `AccountAdminApi` so it writes inside the caller's Prisma transaction (not through `auth.api`). Hashing is argon2id (director ruling). Add a `customRules` rate limit for `/sign-in/username` and decide storage (memory is fine for one container). `disableLogin` uses `users.disabledAt` (no admin plugin), enforced at sign-in (e.g. a `hooks.before` on `/sign-in/username` that gives the generic failure) and in `getSession()`. Force `/change-password` for `mustChangePassword` users. Keep the username plugin's default validator (it matches `USERNAME_PATTERN`). Proxy lives at `web/src/proxy.ts` (approved).
- **Backend:** confirm `runAction`/`unstable_rethrow` naming. You own all of `web/src/lib/` (director ruling).
- **Frontend:** import actions from `@/server/actions/<area>` and `@/auth/actions` (ADR-0002, revised). How the one-time credentials screen works (no reload, copy button).
