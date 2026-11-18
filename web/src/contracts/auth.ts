/**
 * Auth API contract. Implemented by Security in web/src/auth/ on top of
 * Better Auth (Prisma adapter, database-backed sessions, username plugin,
 * nextCookies plugin). See ADR-0004.
 *
 * Callers only ever import from web/src/auth. Nothing outside web/src/auth
 * imports `better-auth` directly, so the library stays replaceable.
 *
 * Every server action, route handler and protected page MUST call
 * requireSession() / requireRole() (or getSession() on mixed pages) before
 * doing anything else. web/src/proxy.ts only does optimistic redirects and
 * is never the authorization boundary.
 */

import type { ActionResult, EmployeeId, UserId } from "./common";

// ─── Roles ──────────────────────────────────────────────────────────────────

/**
 * Legacy `person.access`: 1 = HR admin, 0 = employee. Stored in our own
 * `role` column, which is the source of truth (Better Auth's admin-plugin
 * role/banned fields are not used).
 * Modelled as a const object so it can be used as a value (`Role.HR_ADMIN`)
 * and as a type (`Role`) without a TS `enum`.
 */
export const Role = {
  HR_ADMIN: "HR_ADMIN",
  EMPLOYEE: "EMPLOYEE",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

// ─── Session ────────────────────────────────────────────────────────────────

export interface SessionUser {
  userId: UserId;
  /** Linked employee record. null only for accounts without one. */
  employeeId: EmployeeId | null;
  /** Login name, unique, normalised to lower case. */
  username: string;
  /** "First Last" for the header; falls back to username. */
  displayName: string;
  role: Role;
  /**
   * true after HR creates the account or resets the password, and for
   * migrated users who were still on a plain-text legacy password.
   * While true, requireSession/requireRole send pages to /change-password
   * and make actions return FORBIDDEN, except changePassword and signOut.
   */
  mustChangePassword: boolean;
}

export interface Session {
  user: SessionUser;
  /** ISO timestamp when the session expires. */
  expires: string;
}

export type AuthFailure = "UNAUTHENTICATED" | "FORBIDDEN";

/** Error thrown by requireRole/requireSession in 'throw' mode. */
export interface AuthErrorShape {
  readonly name: "AuthError";
  readonly code: AuthFailure;
  readonly message: string;
}

export interface RequireOptions {
  /**
   * 'throw' (default): throw an AuthError. Use in server actions and route
   *   handlers; the action wrapper maps it to ActionResult.
   * 'redirect': UNAUTHENTICATED -> redirect('/login?callbackUrl=...'),
   *   FORBIDDEN -> the 403 page, mustChangePassword -> /change-password.
   *   Use in pages and their data loaders.
   */
  onFail?: "throw" | "redirect";
  /** Only the change-password page/action set this, so a forced change can complete. */
  allowPendingPasswordChange?: boolean;
}

/**
 * Functions exported from web/src/auth (index.ts). Signatures only.
 * All are server-only (`import 'server-only'`).
 */
export interface AuthApi {
  /**
   * Current session or null. Never throws, never redirects.
   * Reads the database-backed session (cookie cache disabled), joined with
   * the user's current role, `disabledAt` and the linked employee's status.
   * Returns null when the session is missing/expired, the user is gone,
   * `users.disabledAt` is set, or the employee is TERMINATED, so role
   * changes and terminations apply on the next request.
   * Memoised per request with React `cache`.
   */
  getSession(): Promise<Session | null>;

  /** Any signed-in user. */
  requireSession(options?: RequireOptions): Promise<Session>;

  /** Signed-in user whose role is `role` (or one of `role`). */
  requireRole(
    role: Role | readonly Role[],
    options?: RequireOptions,
  ): Promise<Session>;
}

// ─── Account administration (Security implements, Backend calls) ────────────

/** Shown once to HR after create / password reset. Never stored in plain text. */
export interface IssuedCredentials {
  username: string;
  temporaryPassword: string;
}

export interface CreateLoginAccountInput {
  employeeId: EmployeeId;
  username: string;
  displayName: string;
  /**
   * Better Auth's user table requires a unique email: the employee's email
   * when present and unused, otherwise `<username>@users.invalid`.
   */
  email: string;
  role: Role;
}

/**
 * Server-only account helpers so employee services never touch auth tables
 * or password hashing directly. `Tx` is the Prisma transaction client; it is
 * left generic to keep contracts free of Prisma imports. The writes join the
 * caller's transaction. All new hashes are argon2id.
 */
export interface AccountAdminApi {
  /**
   * Creates the auth user + credential account with a random temporary
   * password (>= 12 chars) and mustChangePassword=true.
   * Throws ServiceError('CONFLICT', { username }) if the username is taken.
   */
  createLoginAccount<Tx>(
    tx: Tx,
    input: CreateLoginAccountInput,
  ): Promise<{ userId: UserId; credentials: IssuedCredentials }>;

  /** New temporary password, mustChangePassword=true, all sessions revoked. */
  issueTemporaryPassword<Tx>(
    tx: Tx,
    userId: UserId,
  ): Promise<IssuedCredentials>;

  /**
   * Sets `users.disabledAt = now` (which blocks sign-in and getSession) and
   * deletes all the user's sessions. Used on termination.
   */
  disableLogin<Tx>(tx: Tx, userId: UserId): Promise<void>;
}

// ─── Sign-in / sign-out / change password ───────────────────────────────────

export interface SignInInput {
  username: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Sign-in runs in the browser against Better Auth's HTTP endpoint
 * (/api/auth/sign-in/username) through a wrapper in web/src/auth/client.ts.
 * It is deliberately NOT a server action: Better Auth's built-in rate
 * limiter only applies to HTTP requests, not to server-side `auth.api` calls.
 */
export interface AuthClientApi {
  /**
   * Username match is case-insensitive (legacy parity; the username plugin
   * lower-cases). Failure message is always the generic "Invalid username
   * or password" (no user enumeration), also for disabled users; a
   * rate-limited attempt returns "Too many attempts, try again shortly".
   * On success, `redirectTo` is /change-password when mustChangePassword
   * is set, otherwise the dashboard or a same-origin callbackUrl.
   */
  signInWithUsername(
    input: SignInInput,
  ): Promise<ActionResult<{ redirectTo: string }>>;
}

/** Server actions exported by web/src/auth/actions.ts. */
export interface AuthActions {
  /** Ends the current session. Safe to call when signed out. */
  signOut(): Promise<void>;

  /**
   * Any signed-in user (allowed while mustChangePassword is true). Requires
   * the current password; newPassword must equal confirmPassword and pass
   * the password policy; writes an argon2id hash; revokes the user's other
   * sessions; clears mustChangePassword.
   */
  changePassword(input: ChangePasswordInput): Promise<ActionResult>;
}
