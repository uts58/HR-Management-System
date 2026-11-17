# ADR-0004: Authentication and authorization contract

- Status: Accepted (revised 2026-11-17: Auth.js v5 replaced by Better Auth, per director ruling). Security owns the implementation details in their own ADR.
- Date: 2026-11-17

## Context

Legacy checks only `req.session.name`. **No route checks `access`**, so any signed-in employee can open `/hr/*`, view or delete any employee, approve leave (including their own) and post notices. Passwords are stored and compared in plain text. Login is by first name, so two employees called "John" collide. Mutations are GET links, which makes them CSRF-able.

## Decision

### Library: Better Auth (1.7.x), behind our own API

Config (Security owns `web/src/auth/`; option names checked against the Better Auth docs, Nov 2026):

| Need | Better Auth feature |
|---|---|
| Persistence | `prismaAdapter(prisma, { provider: 'postgresql' })` (`better-auth/adapters/prisma`). Data adds the Better Auth models (`user`, `session`, `account`, `verification`, generated with `npx auth generate`) to `web/prisma/schema.prisma`. |
| Username login | `username()` plugin with `emailAndPassword.enabled: true`. Usernames are lower-cased by default, which matches legacy's case-insensitive login. Sign-in endpoint is `/sign-in/username`. |
| No self sign-up | `emailAndPassword.disableSignUp: true`. HR creates accounts on the server (`AccountAdminApi`). |
| Our fields | `user.additionalFields`: `role` (`HR_ADMIN`/`EMPLOYEE`), `mustChangePassword`, `employeeId`. |
| Sessions | **Database-backed** (Better Auth default). `session.cookieCache` stays **disabled**, so every `getSession()` reads the DB and role changes or terminations apply immediately. Defaults: 7-day expiry, refreshed daily. |
| Next.js | Handler at `app/api/auth/[...all]/route.ts` via `toNextJsHandler(auth)`. `nextCookies()` plugin (listed last) so server actions can set and clear cookies. Server code calls `auth.api.getSession({ headers: await headers() })`, but only inside `web/src/auth`. |
| Password hashing | Better Auth default (scrypt), or argon2id through `emailAndPassword.password.{hash,verify}`. Security decides. Policy: min 8 / max 128 (defaults). |
| Rate limiting | Built in, **production only by default, and only for HTTP requests to `/api/auth/*`. Server-side `auth.api` calls are not limited.** So sign-in goes from the browser to `/api/auth/sign-in/username` (wrapped by `web/src/auth/client.ts`), not through a server action. Add a `customRules` entry for `/sign-in/username` (e.g. 3 per 10 s; the built-in strict rule is documented for `/sign-in/email`). Use `storage: 'database'` if we ever run more than one container. Behind the reverse proxy, set `advanced.ipAddress.ipAddressHeaders` to the one header our proxy overwrites (Platform confirms which). |
| Termination | `AccountAdminApi.disableLogin` blocks sign-in and deletes the user's sessions. `getSession()` also returns null for TERMINATED employees (belt and braces). The admin plugin's `banUser` does the same thing and Security may use it. Its `role` field must then hold our role names. |

**Nothing outside `web/src/auth/` imports `better-auth`.** Callers use the API below, so the library can be swapped later.

### API (types in `web/src/contracts/auth.ts`)

```ts
getSession(): Promise<Session | null>                          // never throws; DB-backed
requireSession(opts?: { onFail?: 'throw' | 'redirect' }): Promise<Session>
requireRole(role: Role | readonly Role[], opts?): Promise<Session>
Role = { HR_ADMIN, EMPLOYEE }                                  // legacy access 1 / 0
AccountAdminApi: createLoginAccount, issueTemporaryPassword, disableLogin   // server-only, called by Backend services
AuthClientApi.signInWithUsername                                // browser
AuthActions: signOut, changePassword                            // server actions
```

### Rules

1. **Every** server action, route handler and protected page calls `requireRole()` or `requireSession()` **as its first statement**. `getSession()` is only for pages that render for both anonymous and signed-in users (the login page, which redirects signed-in users).
2. Actions and route handlers use `onFail: 'throw'` (default). The action wrapper turns the error into `{ ok:false, error:{ code:'UNAUTHENTICATED'|'FORBIDDEN' } }`. Pages use `onFail: 'redirect'`.
3. **Proxy (`web/src/proxy.ts`) is optimistic only.** It uses `getSessionCookie()` (cookie present or not) to send anonymous users to `/login`. It is never the authorization boundary, as both the Next.js and Better Auth docs warn. The `mustChangePassword` redirect happens in `requireSession`/`requireRole`, because the proxy deliberately doesn't hit the DB.
4. Layouts are not an auth boundary. Check in each page or its data loader.
5. Services check the role again and enforce ownership (ADR-0003). Ownership comes from `actor.employeeId`, **never from a request parameter**.
6. `getSession()` is memoised per request with React `cache`. It returns null when the session has expired or been revoked, the user no longer exists, or the linked employee is TERMINATED.
7. Legacy plain-text passwords are hashed with the configured hasher during migration (Data runs it, Security provides the hash function). They go into `account.password` with `providerId = 'credential'`.
8. Accounts created or reset by HR get a random temporary password shown once, plus `mustChangePassword = true`. `changePassword` uses Better Auth's change-password with `revokeOtherSessions: true`, then clears the flag.
9. All mutations are POST: server actions (Next.js checks the Origin header) or Better Auth endpoints (which have their own origin checks; `trustedOrigins` must hold our public URL). Destructive actions ask for confirmation in the UI.
10. Auth tables are written only through `web/src/auth` (`AccountAdminApi`). Backend services never touch `user`/`account`/`session` directly. When an account must change together with an employee (create, terminate, reset), the service passes its Prisma transaction client to `AccountAdminApi`, so it's all one transaction.

### Role matrix (summary; per-function detail in contracts.md)

| Capability | Anonymous | EMPLOYEE | HR_ADMIN |
|---|---|---|---|
| Login page | yes | – (redirected to dashboard) | – |
| Dashboard with notices, own profile, change password | – | yes | yes |
| Apply for / view own leave | – | yes | – (legacy parity; revisit after cutover) |
| Employees, departments, positions, notices admin, leave decisions, appraisals | – | – | yes |

Terminated employees can't sign in, and their existing sessions stop working.

## Consequences

- QA owns an **authorization-matrix test** (`web/tests/`) that calls every exported server action as anonymous, EMPLOYEE, HR_ADMIN and terminated-employee, and checks the result codes. A new action without a matrix row fails CI.
- Platform adds a lint check that flags `'use server'` files where no exported function calls `requireRole`/`requireSession`, plus a `no-restricted-imports` rule for `better-auth` outside `web/src/auth/`.
- A DB read per request is the price of instant revocation. The load is trivial at this app's scale.
- `createLoginAccount` has to write Better Auth's tables inside our transaction, so it can't go through `auth.api` (which uses its own adapter connection). Security implements it with Better Auth's password hasher and Prisma `tx` writes, and covers it with tests.
