# ADR-0004: Authentication and authorization contract

- Status: Accepted (Security owns the implementation details in their own ADR)
- Date: 2026-11-17

## Context

Legacy checks only `req.session.name`. **No route checks `access`**, so any signed-in employee can open `/hr/*`, view or delete any employee, approve leave (including their own) and post notices. Passwords are stored and compared in plain text. Login is by first name, so two employees called "John" collide. Mutations are GET links, which makes them CSRF-able.

## Decision

### API (types in `web/src/contracts/auth.ts`, implementation in `web/src/auth/`)

```ts
getSession(): Promise<Session | null>                         // never throws
requireSession(opts?: { onFail?: 'throw' | 'redirect' }): Promise<Session>
requireRole(role: Role | readonly Role[], opts?): Promise<Session>
Role = { HR_ADMIN, EMPLOYEE }                                 // legacy access 1 / 0
```

### Rules

1. **Every** server action, route handler and protected page calls `requireRole()` or `requireSession()` **as its first statement**. `getSession()` is only for pages that render for both anonymous and signed-in users (the login page).
2. Actions and route handlers use `onFail: 'throw'` (default). The action wrapper turns the error into `{ ok:false, error:{ code:'UNAUTHENTICATED'|'FORBIDDEN' } }`. Pages use `onFail: 'redirect'`.
3. **Proxy (`web/src/proxy.ts`) is optimistic only.** It redirects anonymous users to `/login` and users with `mustChangePassword` to `/change-password`, using only the cookie. It is never the authorization boundary, as the Next.js docs warn.
4. Layouts are not an auth boundary (they don't re-render on navigation, and child segments and actions are reached anyway). Check in each page or its data loader.
5. Services check the role again and enforce ownership (ADR-0003). Ownership comes from `actor.employeeId`, **never from a request parameter** (fixes legacy `viewDetails?id=` probing).
6. `getSession()` re-reads the user's role and existence from the database once per request (memoised with React `cache`), so deleting a user or changing a role takes effect right away even though the session is a JWT.
7. Passwords are hashed (algorithm is Security's choice, argon2id or bcrypt). Legacy plain-text passwords are hashed during migration (Data + Security).
8. Accounts created by HR, or reset by HR, get a random temporary password shown once, plus `mustChangePassword = true`.
9. All mutations are POST server actions. Next.js server actions check the Origin header, which covers CSRF. Destructive actions ask for confirmation in the UI.

### Session strategy

The Credentials provider does not persist sessions in the database, so we use the **JWT strategy**. The token carries `userId` and `role` only (no PII). Rule 6 covers revocation.

### Role matrix (summary; per-function detail in contracts.md)

| Capability | Anonymous | EMPLOYEE | HR_ADMIN |
|---|---|---|---|
| Recent notices on login page | yes | yes | yes |
| Dashboard, own profile, change password | – | yes | yes |
| Apply for / view own leave | – | yes | – (parity, open question) |
| Employees, departments, positions, notices admin, leave decisions, appraisals | – | – | yes |

## Consequences

- QA owns an **authorization-matrix test** (`web/tests/`) that calls every exported server action as anonymous, EMPLOYEE and HR_ADMIN and checks the result codes. A new action without a matrix row fails CI.
- Platform adds a lint check that flags `'use server'` files where no exported function calls `requireRole`/`requireSession` (pattern-based, backed up by the matrix test).
