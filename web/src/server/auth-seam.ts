/**
 * The single seam between `server/` and Security's `@/auth` module.
 *
 * `defineAction` needs `requireRole` and `requireSession` with the
 * signatures in `web/src/contracts/auth.ts` (`AuthApi`):
 * - `requireRole(role | roles, { onFail: "throw", allowPendingPasswordChange? })`
 *   and `requireSession(sameOptions)` returning `Promise<Session>`;
 * - in "throw" mode, failures throw an Error with `name === "AuthError"`
 *   and `code` "UNAUTHENTICATED" | "FORBIDDEN" (`AuthErrorShape`), which
 *   `@/server/errors` recognises by shape (no class import needed);
 * - `mustChangePassword` users get FORBIDDEN unless
 *   `allowPendingPasswordChange` is true.
 */

import "server-only";

import type { AuthApi } from "@/contracts/auth";

export type AuthGate = Pick<AuthApi, "requireRole" | "requireSession">;

export { requireRole, requireSession } from "@/auth";
