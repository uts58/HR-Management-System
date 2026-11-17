/**
 * Auth API contract. Implemented by Security in web/src/auth/ on top of Auth.js v5
 * (Credentials provider, JWT session strategy). See ADR-0004.
 *
 * Every server action, route handler and protected page MUST call one of
 * getSession() / requireRole() before doing anything else. The proxy
 * (web/src/proxy.ts on Next.js 16) only does optimistic redirects and is never
 * the authorization boundary.
 */

import type { ActionResult, EmployeeId, UserId } from './common';

// ─── Roles ────────────────────────────────────────────────────────────────────

/**
 * Legacy `person.access`: 1 = HR admin, 0 = employee.
 * Modelled as a const object so it can be used as a value (`Role.HR_ADMIN`)
 * and as a type (`Role`) without a TS `enum`.
 */
export const Role = {
  HR_ADMIN: 'HR_ADMIN',
  EMPLOYEE: 'EMPLOYEE',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

// ─── Session ──────────────────────────────────────────────────────────────────

export interface SessionUser {
  userId: UserId;
  /** Linked employee record. null only for accounts without one. */
  employeeId: EmployeeId | null;
  /** Login name, unique, case-insensitive. */
  username: string;
  /** "First Last" for the header; falls back to username. */
  displayName: string;
  role: Role;
  /**
   * true after HR creates the account or resets the password.
   * While true, every page except /change-password redirects there and every
   * action except changePassword/signOut returns FORBIDDEN.
   */
  mustChangePassword: boolean;
}

export interface Session {
  user: SessionUser;
  /** ISO timestamp when the session expires. */
  expires: string;
}

export type AuthFailure = 'UNAUTHENTICATED' | 'FORBIDDEN';

/** Error thrown by requireRole/requireSession in 'throw' mode. */
export interface AuthErrorShape {
  readonly name: 'AuthError';
  readonly code: AuthFailure;
  readonly message: string;
}

export interface RequireOptions {
  /**
   * 'throw' (default): throw an AuthError. Use in server actions and route
   *   handlers; the action wrapper maps it to ActionResult.
   * 'redirect': UNAUTHENTICATED -> redirect('/login?callbackUrl=...'),
   *   FORBIDDEN -> the 403 page. Use in pages/layouts' data loaders.
   */
  onFail?: 'throw' | 'redirect';
}

/**
 * Functions exported from web/src/auth (index.ts). Signatures only.
 * All are server-only (`import 'server-only'`).
 */
export interface AuthApi {
  /**
   * Current session or null. Never throws, never redirects.
   * Must confirm the user still exists and read the current role from the
   * database (secure check), not only trust the JWT, so deleting a user or
   * changing a role takes effect on the next request.
   * Memoised per request with React `cache`.
   */
  getSession(): Promise<Session | null>;

  /** Any signed-in user. */
  requireSession(options?: RequireOptions): Promise<Session>;

  /** Signed-in user whose role is `role` (or one of `role`). */
  requireRole(role: Role | readonly Role[], options?: RequireOptions): Promise<Session>;
}

// ─── Auth server actions (implemented by Security; return ActionResult directly) ───────────────────────

export interface SignInInput {
  username: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AuthActions {
  /**
   * Verifies credentials, creates the session. Username match is
   * case-insensitive (legacy parity). Failure message is always the same
   * generic "Invalid username or password" (no user enumeration).
   * Rate limiting is Security's call.
   */
  signIn(input: SignInInput): Promise<ActionResult<{ redirectTo: string }>>;

  /** Ends the session. Safe to call when signed out. */
  signOut(): Promise<void>;

  /**
   * Any signed-in user. Requires the current password; newPassword must
   * equal confirmPassword and pass the password policy; clears
   * mustChangePassword.
   */
  changePassword(input: ChangePasswordInput): Promise<ActionResult>;
}
