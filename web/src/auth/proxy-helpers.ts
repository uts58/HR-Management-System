import { getSessionCookie } from "better-auth/cookies";
import { MUST_CHANGE_COOKIE } from "./paths";

/**
 * Cookie checks for web/src/proxy.ts. Presence only: no DB access and no
 * signature checks, so these are optimistic hints, never authorization
 * (ADR-0004 rule 3). No `server-only` import, because proxy.ts loads this.
 */

/** A Better Auth session cookie is present (it may still be expired or revoked). */
export function hasSessionCookie(request: Request): boolean {
  return getSessionCookie(request) !== null;
}

/** The sign-in hook flagged this browser for a forced password change. */
export function hasMustChangeHint(cookieValue: string | undefined): boolean {
  return cookieValue === "1";
}

export { MUST_CHANGE_COOKIE };
