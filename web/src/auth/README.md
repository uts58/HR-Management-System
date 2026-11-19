# web/src/auth (Security)

Authentication and authorization for the new app, on Better Auth 1.7
(ADR-0004, contract `web/src/contracts/auth.ts`). Nothing outside this
folder (and the one-line route in `src/app/api/auth/[...all]/route.ts`)
imports `better-auth`.

## What to import

| Import           | Who                                                       | What                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@/auth`         | server code (pages, actions via `defineAction`, services) | `getSession`, `requireSession`, `requireRole`, `Role`, `AuthError`, `isAuthError`, `accountAdmin` (+ types `Session`, `SessionUser`, `RequireOptions`, `AuthFailure`, `AccountAdminApi`, `IssuedCredentials`) |
| `@/auth/actions` | Frontend forms                                            | server actions `changePassword`, `signOut`                                                                                                                                                                    |
| `@/auth/client`  | the login form (client component) only                    | `signInWithUsername(input, callbackUrl?)`                                                                                                                                                                     |
| `@/auth/paths`   | anyone                                                    | `LOGIN_PATH`, `CHANGE_PASSWORD_PATH`, `DASHBOARD_PATH`, `FORBIDDEN_PATH`, `safeCallbackPath`                                                                                                                  |

Everything else in this folder is internal.

## Pages and actions

```ts
// Protected page (Server Component)
const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });

// Mixed page (login): redirect signed-in users away
const session = await getSession();
if (session)
  redirect(
    session.user.mustChangePassword ? CHANGE_PASSWORD_PATH : DASHBOARD_PATH,
  );

// Server actions: use defineAction (Backend); it calls requireRole/requireSession in throw mode.
```

`onFail: "redirect"`: anonymous → `/login?callbackUrl=<path>`, wrong role →
`/forbidden` (**Frontend: please provide this page**), pending forced
change → `/change-password`. Throw mode: `AuthError` with `code`
`UNAUTHENTICATED` / `FORBIDDEN`.

`getSession()` reads the database every request (memoised per request with
React `cache`). It returns null for expired/revoked sessions, deleted users,
`users.disabledAt` set, or a TERMINATED employee (and deletes that user's
sessions).

## Login form (Frontend)

```tsx
"use client";
import { signInWithUsername } from "@/auth/client";

const result = await signInWithUsername(
  { username, password },
  searchParams.get("callbackUrl"),
);
if (result.ok) router.replace(result.data.redirectTo);
else setError(result.error.message); // always generic, or the rate-limit message
```

It POSTs JSON to `/api/auth/sign-in/username` from the browser (not a server
action), so Better Auth's rate limiter applies. `redirectTo` is
`/change-password` for users who must change their password, otherwise a
same-origin `callbackUrl` or `/dashboard`. After a successful sign-in call
`router.refresh()` or navigate with `router.replace` so server components
see the new cookie.

## Change password / sign out (Frontend)

```tsx
import { changePassword, signOut } from "@/auth/actions";

<form action={changePassword}> currentPassword, newPassword, confirmPassword </form>
// or: const [state, action] = useActionState(changePassword, null);

<form action={signOut}><button>Sign out</button></form>
```

- `changePassword`: `changePasswordSchema` (lib/validation/auth.ts) + current
  password check (argon2id or legacy bcrypt) + not equal to the username.
  Field errors on `currentPassword` / `newPassword` / `confirmPassword`.
  On success: argon2id hash written, `mustChangePassword` cleared, every
  **other** session of the user deleted (this one stays). Then redirect to
  `/dashboard` yourself.
- `signOut`: deletes the session and clears the cookies. Then redirect to
  `/login`. Until Backend adds `role: "PUBLIC"`, calling it without a valid
  session returns `UNAUTHENTICATED`; treat that as signed out.

## Wiring Frontend's UI (after both branches merge)

| Frontend expects                                                         | Use                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/_stubs/session.ts` (session for the `(app)` layout and page guards) | `getSession()` in the layout for the header; each page calls `requireRole(…, { onFail: "redirect" })` / `requireSession({ onFail: "redirect" })` itself (layouts are not an auth boundary, ADR-0004 rule 4). Then delete the stub. |
| `signOutAction` for `AppShell`                                           | `signOut` from `@/auth/actions` (pass it as `signOutAction={signOut}`). After it resolves, `router.replace(LOGIN_PATH)`.                                                                                                           |
| `changePassword` in `change-password-form.tsx` (also the forced change)  | `changePassword` from `@/auth/actions`. The page itself calls `requireSession({ onFail: "redirect", allowPendingPasswordChange: true })`. On `ok`, `router.replace(DASHBOARD_PATH)`.                                               |
| `login/login-form.tsx`                                                   | `signInWithUsername` from `@/auth/client`, as in "Login form" above.                                                                                                                                                               |
| `/` and `/login` redirects                                               | `getSession()`: signed out → `/login` (on `/`); signed in → `CHANGE_PASSWORD_PATH` if `session.user.mustChangePassword`, else `DASHBOARD_PATH`.                                                                                    |

**403 decision:** a role failure in a **page** (`onFail: "redirect"`)
**redirects to `/forbidden`** (Frontend's page with `ForbiddenState`). We
don't render it in place because `forbidden()` needs the experimental
`authInterrupts` flag, which is off. Actions return `FORBIDDEN` through
`defineAction`, so forms show the message instead.

## AccountAdminApi (Backend's employee service)

```ts
import { accountAdmin } from "@/auth";

await prisma.$transaction(async (tx) => {
  const employee = await tx.employee.create({ ... });
  const { userId, credentials } = await accountAdmin.createLoginAccount(tx, {
    employeeId: employee.id, username, displayName, email, role,
  });
  return { employee, credentials }; // show credentials.temporaryPassword ONCE
});
```

- `createLoginAccount(tx, input)`: username lower-cased and checked against
  `USERNAME_PATTERN`; taken → `ServiceError`-shaped `CONFLICT` (field
  `username`). Email: the given one (lower-cased) if valid and not used by
  another user, else `<username>@users.invalid` with
  `emailIsPlaceholder = true`. 16-character temporary password, argon2id,
  `mustChangePassword = true`.
- `issueTemporaryPassword(tx, userId)`: new temporary password (creates the
  credential row if missing), `mustChangePassword = true`, all sessions
  deleted. `NOT_FOUND` for an unknown user.
- `disableLogin(tx, userId)`: sets `disabledAt` (keeps an earlier value) and
  deletes all sessions. `NOT_FOUND` for an unknown user.

All three write with the caller's `tx`, so they roll back with it. Never log
`temporaryPassword`.

## Security behaviour

- **Hashing**: argon2id (`@node-rs/argon2`, m = 19 MiB, t = 2, p = 1) for
  every new hash. Verify also accepts bcrypt `$2a$`/`$2b$`/`$2y$` (bcryptjs;
  passwords over 72 bytes never match a bcrypt hash). After a successful
  sign-in a `hooks.after` replaces a bcrypt hash with argon2id using
  compare-and-swap (`UPDATE … WHERE password = <old hash>`); a failed rehash
  is logged and never fails the login.
- **Disabled / terminated**: `hooks.before` on `/sign-in/username` rejects
  them with the same 401 and message as a wrong password, after spending an
  argon2 hash so timing matches.
- **Endpoints**: only `/sign-in/username`, `/sign-out`, `/get-session`,
  `/ok`, `/error` are served (allowlist in `route-handler.ts`, plus
  `disabledPaths`). No sign-up, email sign-in, update-user, password reset
  or account linking over HTTP. All `user.additionalFields` are
  `input: false`.
- **Rate limits on `/sign-in/username`** (HTTP only; client IP =
  `X-Forwarded-For`, which Caddy overwrites, docs/platform/deployment.md):
  - **per username + IP: 10 failures per 60 s** (legacy parity,
    `login-limiter.ts`, enforced in the sign-in hooks). A success clears
    it. One person mistyping locks only themselves, not colleagues behind
    the same office NAT address, and failures from elsewhere don't lock
    the account for everyone.
  - **per IP: 50 attempts per 60 s** (Better Auth built-in, enabled in
    every environment). Other endpoints: 100 per 60 s.
  - Both answer 429 (`X-Retry-After`), which the client shows as "Too many
    attempts, try again shortly".
  - **Both are in-memory, per process. That is only correct for the single
    v1 container.** With more than one instance, move both to shared
    storage (Better Auth `storage: "database"` and a DB-backed failure
    counter).
- **Sessions**: database-backed, cookie cache off, 7-day expiry refreshed
  daily, cookies `Secure` when `BETTER_AUTH_URL` is https.
- **Forced password change**: enforced server-side in
  `requireSession`/`requireRole` (FORBIDDEN / redirect) unless the caller
  passes `allowPendingPasswordChange` (only `changePassword` and `signOut`).
  `proxy.ts` also redirects page loads to `/change-password` using the
  `hr.must_change_password` hint cookie set at sign-in; it is only a hint
  (no DB access in the proxy), so removing it gains nothing.
- **Proxy** (`src/proxy.ts`): anonymous GET/HEAD of a protected page →
  `/login?callbackUrl=…`. Never the authorization boundary.
- **Times**: everything is UTC on the server; `Session.expires` is an ISO
  UTC string. Format it in the viewer's browser if it is ever shown.

## Tests

- Unit (no DB): `src/auth/*.test.ts`, `src/proxy.test.ts`.
- Integration (real Postgres): `tests/integration/auth/`. Needs a migrated
  throwaway database: the tests TRUNCATE the auth and employee tables.

```bash
DATABASE_URL=postgresql://…/hr_web_test BETTER_AUTH_SECRET=<32+ chars> \
BETTER_AUTH_URL=http://localhost:3000 npm run test:integration
```
