# Service contracts

Owner: Tech Lead. Status: Phase 0 draft, 2026-11-17.
TypeScript source of truth: [`web/src/contracts/`](../../web/src/contracts/). If this document and the `.ts` files disagree, the `.ts` files win and this document gets fixed.

## Conventions (all domains)

- Every service function is `fn(actor: Actor, ...args)`, except `noticeService.listPublicNotices` (anonymous). `Actor = { userId, employeeId | null, role }` comes from the session (ADR-0003).
- "Role" below is the role the **service** enforces. The calling action enforces it too, with `requireRole` (ADR-0004).
- Services throw `ServiceError` with the listed codes. Actions return `ActionResult<T>` (ADR-0006). `UNAUTHENTICATED`/`INTERNAL` can come from any action and aren't repeated below.
- Calendar dates are `IsoDate` (`YYYY-MM-DD`), instants are `Date` (ADR-0007).
- String inputs are trimmed. Empty optional strings become `null`.
- Read models allow `null` wherever migrated legacy data can be empty, even when create/update now require the field.
- Legend: **[CHANGE]** = intentional change from legacy, **[NEW]** = no legacy equivalent, needs director approval.

---

## Auth

Implemented by Security in `web/src/auth/`. Types: `contracts/auth.ts`.

### Auth API (called by every action/page)

| Function | Returns | Behaviour |
|---|---|---|
| `getSession()` | `Promise<Session \| null>` | Never throws. Re-reads role/existence from the DB once per request. |
| `requireSession(opts?)` | `Promise<Session>` | Any signed-in user. `onFail: 'throw'` (default) throws `AuthError('UNAUTHENTICATED')`. `'redirect'` sends to `/login?callbackUrl=…`. |
| `requireRole(role \| roles, opts?)` | `Promise<Session>` | As above, plus `AuthError('FORBIDDEN')` / the 403 page when the role doesn't match. |
| `Role` | `'HR_ADMIN' \| 'EMPLOYEE'` | Legacy `person.access` 1 / 0. |

`SessionUser = { userId, employeeId | null, username, displayName, role, mustChangePassword }`.

### Auth actions (`AuthActions`)

| Action | Role | Input | Output | Errors |
|---|---|---|---|---|
| `signIn` | anonymous | `{ username, password }` | `ActionResult<{ redirectTo }>` | `VALIDATION` (generic "Invalid username or password") |
| `signOut` | any | – | `void` | – |
| `changePassword` | any signed-in | `{ currentPassword, newPassword, confirmPassword }` | `ActionResult` | `VALIDATION` (wrong current password → field `currentPassword`; mismatch → `confirmPassword`; policy → `newPassword`) |

### Business rules

1. Username matching is case-insensitive (legacy parity: `mode: 'insensitive'`).
2. Login failures always give the same message, whether or not the user exists.
3. After sign-in, everyone lands on `/dashboard` (legacy `/home`), or on `callbackUrl` if it's same-origin.
4. While `mustChangePassword` is true, only `/change-password`, `changePassword` and `signOut` are allowed.
5. Password policy (Security sets the final numbers): minimum 8 characters, not equal to the username, not equal to the current password.

### Behaviour changes

- **[CHANGE]** Login uses a stable `username`, no longer the employee's first name (`person.Name`). Legacy renamed the login when HR edited the first name, and two employees with the same first name collided.
- **[CHANGE]** Passwords are hashed. Legacy stored and compared plain text.
- **[CHANGE]** Roles are enforced on every route. Legacy checked only "logged in".
- **[CHANGE]** Logout is a POST action. Legacy used `GET /logout`.

---

## Employee

Implemented by Backend in `web/src/server/employee/`. Types: `contracts/employee.ts`.

| Function | Role | Input → Output | Errors |
|---|---|---|---|
| `listEmployees(actor)` | HR_ADMIN | → `EmployeeListItem[]` (id asc) | `FORBIDDEN` |
| `listEmployeeOptions(actor)` | HR_ADMIN | → `Option<EmployeeId>[]` (first name asc) | `FORBIDDEN` |
| `getEmployee(actor, id)` | HR_ADMIN any; EMPLOYEE own only | → `EmployeeDetail` | `NOT_FOUND` (also for someone else's id) |
| `getMyProfile(actor)` | any | → `EmployeeDetail` | `NOT_FOUND` (account has no employee record) |
| `getEmployeeFormOptions(actor)` | HR_ADMIN | → `EmployeeFormOptions` | `FORBIDDEN` |
| `createEmployee(actor, CreateEmployeeInput)` | HR_ADMIN | → `CreateEmployeeResult { employee, credentials }` | `VALIDATION`, `CONFLICT` (username) |
| `updateEmployee(actor, id, UpdateEmployeeInput)` | HR_ADMIN | → `EmployeeDetail` | `NOT_FOUND`, `VALIDATION` |
| `deleteEmployee(actor, id)` | HR_ADMIN | → `void` | `NOT_FOUND`, `CONFLICT` (self / last HR admin) |
| `resetEmployeePassword(actor, id)` **[NEW]** | HR_ADMIN | → `IssuedCredentials` | `NOT_FOUND` |

### Field rules (`CreateEmployeeInput` / `UpdateEmployeeInput`)

The legacy form said "All fields are mandatory except Middle name". We now enforce that on the server.

| Field | Rule | Legacy |
|---|---|---|
| firstName, lastName | required, 1–100 | client-only check |
| middleName | optional, ≤100 | – |
| departmentId, positionId | required, must exist | `"0"` sentinel, not checked on the server |
| country | one of `COUNTRIES` (8 values) | same list, not required on the client |
| homeTown | required, 1–100 | client-only |
| contactNo | required, 5–20 chars of `0-9 + - ( ) space` | digits only, enforced by keypress filter |
| email | required, valid, ≤254, stored lower-case. **Not** unique. | client regex |
| gender | `MALE` \| `FEMALE` | `1` / `0`, default male |
| maritalStatus | `SINGLE` \| `MARRIED` \| `DIVORCED` | lower-case strings, `"0"` if not chosen |
| dateOfBirth | `IsoDate`, before today | free text "01 Jan 2019" |
| username (create only) | optional, 3–50, `[a-z0-9._-]`, unique (case-insensitive). Default `first.last`, with `2`, `3`… added if taken. | `person.Name = firstName` |

### Business rules

1. **Employee ID generation [CHANGE]:** the database assigns ids (identity/sequence). The migration keeps legacy ids and moves the sequence past `max(id)`. Legacy computed `max(id)+1` when the form loaded and trusted the read-only field the browser sent back, which races when two HR users add employees at once.
2. **Create** inserts the employee and its login account (role `EMPLOYEE`, random temporary password of at least 12 characters, `mustChangePassword = true`) in **one transaction**. The plain temporary password is returned once in `credentials` and shown to HR on the success screen. It is never logged or stored in plain text. **[CHANGE]** Legacy generated an 8-character random password that nobody could ever see, so new employees could not log in.
3. New accounts are always `EMPLOYEE` (parity: there is no UI to create HR admins. The seed and migration create them).
4. **Update** does not touch the username or the role. **[CHANGE]** Legacy set `person.Name` to the new first name, which changed the login name.
5. **Delete** removes the employee, their account, their leave requests and their appraisals in one transaction. Blocked with `CONFLICT` when `id === actor.employeeId` (no deleting yourself) or when it would remove the last `HR_ADMIN`. **[CHANGE]** Legacy deleted `employee` + `person` and left leave/performance rows pointing at nothing. (Soft delete is an open question for the director.)
6. **Listing [CHANGE]:** shows every employee, the HR admin included, with a role badge. Legacy hid `id == 1` by hard-coding it.
7. **Visibility:** EMPLOYEE can only see their own record through `getMyProfile`/`getEmployee(own id)`. **[CHANGE]** In legacy any logged-in user could open `/hr/viewDetails?id=N` for anyone.
8. HR's own "View Profile" uses `getMyProfile` (legacy linked to `viewDetails?id=<own id>`).

---

## Org

Departments and positions. Implemented by Backend in `web/src/server/org/`. Types: `contracts/org.ts`.

| Function | Role | Input → Output | Errors |
|---|---|---|---|
| `listDepartments(actor)` | HR_ADMIN | → `Department[]` (id asc, with `employeeCount`) | `FORBIDDEN` |
| `createDepartment(actor, { name })` | HR_ADMIN | → `Department` | `VALIDATION`, `CONFLICT` |
| `deleteDepartment(actor, id)` | HR_ADMIN | → `void` | `NOT_FOUND`, `CONFLICT` |
| `listPositions(actor)` | HR_ADMIN | → `Position[]` (id asc, with `employeeCount`) | `FORBIDDEN` |
| `createPosition(actor, { name })` | HR_ADMIN | → `Position` | `VALIDATION`, `CONFLICT` |
| `deletePosition(actor, id)` | HR_ADMIN | → `void` | `NOT_FOUND`, `CONFLICT` |

### Business rules

1. Name is trimmed, 1–100 characters, required (parity: legacy rejected blank names with "Name required").
2. **[CHANGE]** Names are unique case-insensitive within their table → `CONFLICT` "A department with this name already exists". Legacy allowed duplicates.
3. **Deleting a department or position that employees use [CHANGE]:** rejected with `CONFLICT` "N employees are assigned to this department. Reassign them first." The UI disables the delete button when `employeeCount > 0`. Legacy deleted the row (no foreign key), and those employees then showed an empty position/department everywhere.
4. Rename is not supported (parity).

---

## Leave

Implemented by Backend in `web/src/server/leave/`. Types: `contracts/leave.ts`.

| Function | Role | Input → Output | Errors |
|---|---|---|---|
| `applyForLeave(actor, ApplyForLeaveInput)` | EMPLOYEE | → `LeaveRequest` | `VALIDATION`, `FORBIDDEN` |
| `listMyLeaveRequests(actor)` | EMPLOYEE | → `LeaveRequest[]` (newest first) | `FORBIDDEN` |
| `markMyLeaveDecisionsSeen(actor)` | EMPLOYEE | → `number` (rows changed) | `FORBIDDEN` |
| `countMyUnseenDecisions(actor)` | EMPLOYEE | → `number` | `FORBIDDEN` |
| `listPendingLeaveRequests(actor)` | HR_ADMIN | → `LeaveRequest[]` (oldest first) | `FORBIDDEN` |
| `listAllLeaveRequests(actor)` | HR_ADMIN | → `LeaveRequest[]` (newest first) | `FORBIDDEN` |
| `countPendingLeaveRequests(actor)` | HR_ADMIN | → `number` | `FORBIDDEN` |
| `decideLeaveRequest(actor, id, 'APPROVED' \| 'REJECTED')` | HR_ADMIN | → `LeaveRequest` | `NOT_FOUND`, `CONFLICT` |

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

1. `leaveType` ∈ `LEAVE_TYPES` (Sick, Annual, Casual, Maternity, Unpaid; same labels as legacy, stored verbatim). `startDate`/`endDate` are `IsoDate`, `endDate ≥ startDate`. `reason` is optional, ≤1000. Past dates are allowed (e.g. sick leave logged afterwards).
2. New requests are always `PENDING` for `actor.employeeId`. The employee id is never read from input.
3. **[CHANGE]** Only `PENDING` requests can be decided. Deciding again gives `CONFLICT`. Legacy `GET /assignLeave?id=&status=` accepted any integer status at any time, from any logged-in user.
4. A decision sets `decidedAt = now`, `decidedBy = actor.userId` **[NEW, audit]**, `seenByEmployee = false`.
5. **Notification (legacy `read` flag):** the employee dashboard shows "Your leave request has been reviewed (N)" when `countMyUnseenDecisions > 0`. Opening leave history shows the list, and the page then calls `markMyLeaveDecisionsSeen`. **[CHANGE]** Legacy did that update inside the GET handler. We keep reads free of side effects so link prefetching can't mark items as seen.
6. HR dashboard shows "Pending leave requests (N)" linking to the approval queue. **[CHANGE / bug fix]** Legacy compared `title == 'in'`, which is never true, so HR never saw the count and saw the employee message instead.
7. No balance tracking, no overlap check, no cancellation (none exist in legacy, see open questions).
8. Requests whose employee no longer exists show "Unknown employee" (legacy showed the raw id).

---

## Notice

Implemented by Backend in `web/src/server/notice/`. Types: `contracts/notice.ts`.

| Function | Role | Input → Output | Errors |
|---|---|---|---|
| `listPublicNotices(limit = 5)` | anonymous | → `Notice[]` (newest first) | – |
| `listRecentNotices(actor, limit = 5)` | any | → `Notice[]` (newest first) | – |
| `listNotices(actor)` | HR_ADMIN | → `Notice[]` (newest first) | `FORBIDDEN` |
| `createNotice(actor, CreateNoticeInput)` | HR_ADMIN | → `Notice` | `VALIDATION` |
| `deleteNotice(actor, id)` | HR_ADMIN | → `void` | `NOT_FOUND` |

### Business rules

1. `title` 1–200, `body` 1–5000 (both required **[CHANGE]**: legacy stored empty strings), `type` ∈ `GENERAL | URGENT | HOLIDAY` (legacy 0/1/2).
2. `createdAt` is set by the database. **[CHANGE]** Legacy stored the server's `toLocaleDateString()` text.
3. The login page and dashboard show the 5 newest. Urgent notices are visually highlighted (legacy highlighted `type == 1` on the login page).
4. **Parity:** the login page shows notices to anonymous visitors. Security to confirm that is acceptable.
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

1. `employeeId` is required and must exist (`VALIDATION` on field `employeeId`). **[CHANGE]** Legacy accepted an empty selection, which failed silently.
2. `projectName` 1–200 required, `projectStart`/`projectEnd` `IsoDate` with end ≥ start, `rating` ∈ 1..5 (labels Poor … Excellent, default 3 in the form). **[CHANGE]** Legacy had free-text dates and no server checks.
3. Employees cannot see their own appraisals (parity; there was no such page).
4. Deleting an employee deletes their appraisals (see Employee rule 5).

---

## Dropped

- `Message` model and table: unused, dropped (director decision).
- `routes/users.js`: never mounted.

---

## Open questions for Data

These are assumptions the contracts make about the Prisma schema. Please confirm or push back.

1. **User vs Employee.** Contracts assume a `User` (login) table 1:1 with `Employee` through a **nullable unique** `employeeId`, replacing `person`. `UserId` is an opaque string. Is that your plan, or do you keep `person.id = employee.id` as text? Are there production `person` rows without an `employee` row (or the other way round)?
2. **Username.** New `username` column, unique on `lower(username)` (citext or a unique index on an expression). Migration: `username = lower(person.Name)`. **How do we resolve collisions** in production data (suffix `2`, `3`…, plus a report to HR)?
3. **Role.** Postgres enum `Role { HR_ADMIN, EMPLOYEE }` mapped from `access` 1/0. Do any other `access` values exist in production?
4. **Password columns.** `passwordHash`, `mustChangePassword boolean default false`. Migrated users keep their current password, hashed during migration (`mustChangePassword = false`). Coordinate the algorithm with Security.
5. **Foreign keys.** `employee.departmentId`/`positionId` → `ON DELETE RESTRICT`. `leave_request.employeeId` and `appraisal.employeeId` → `ON DELETE CASCADE` (or RESTRICT if the director picks soft delete). What do we do with **existing orphans** (employees pointing at deleted departments, leave rows for deleted employees)? Proposal: null the department/position on employees (columns nullable in read models) and keep orphan leave/appraisal rows only if we add a nullable FK; otherwise report and drop.
6. **Type changes.** `empleave.empid` String → Int FK. `performance.empId` stays Int. Status Int → enum `LeaveStatus`, `read` Int → `seenByEmployee boolean`. `notice.type` Int → enum. `gender` Int → enum. `maritalStatus` text → enum (`'0'` → null).
7. **Dates.** `date` columns for DOB, leave start/end and project start/end, parsed per ADR-0007 with a report of rows that fail. `timestamptz` `createdAt` on employee, leave, notice and appraisal (null for migrated rows; is backfilling `notice.date` worth it?).
8. **New columns:** `leave_request.decidedAt`, `decidedByUserId`; `employee.createdAt`, `updatedAt`.
9. **Sequences.** Keep legacy ids for all tables and reset each identity to `max(id)+1`.
10. **Unique names** on `lower(department.name)`, `lower(position.name)`. Duplicates in production need a merge rule (reassign employees to the lowest id).
11. **Naming.** Contracts use `LeaveRequest`/`Appraisal`/`body`/`projectStart`. Table and column names are your call; services map them.

## Open questions for other leads

- **Security:** move `web/src/middleware.ts` → `web/src/proxy.ts` (Next 16 rename). Hashing algorithm, rate limiting for `signIn`, the temporary-password policy, whether notices stay public, and your Auth.js v5 vs Better Auth position.
- **Backend:** confirm `runAction`/`unstable_rethrow` naming. Ownership of `web/src/lib/dates.ts`.
- **Frontend:** actions colocated in `app/**/actions.ts` (ADR-0002). How the one-time credentials screen works (no reload, copy button).
- **QA:** please confirm in `legacy-tests/` that `POST /hr/saveEmp` and `/hr/editEmp` actually fail (multipart body is never parsed), so the parity baseline is right.
