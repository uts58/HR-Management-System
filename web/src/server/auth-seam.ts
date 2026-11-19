/**
 * The single seam between `server/` and Security's `@/auth` module.
 *
 * `defineAction` needs `requireRole` and `requireSession` with the
 * signatures in `web/src/contracts/auth.ts` (`AuthApi`). Security has not
 * merged `web/src/auth/` yet, so this file holds a FAIL-CLOSED placeholder:
 * every call throws an `AuthError`-shaped UNAUTHENTICATED error, so every
 * action built with `defineAction` returns `{ ok: false, error: { code:
 * "UNAUTHENTICATED" } }` and no handler can run unauthenticated.
 *
 * When `web/src/auth/index.ts` lands, replace everything below the type
 * export with:
 *
 *   export { requireRole, requireSession } from "@/auth";
 *
 * What Security must provide from `@/auth` (contract `AuthApi`):
 * - `requireRole(role | roles, { onFail: "throw", allowPendingPasswordChange? })`
 *   and `requireSession(sameOptions)` returning `Promise<Session>`;
 * - in "throw" mode, failures throw an Error with `name === "AuthError"`
 *   and `code` "UNAUTHENTICATED" | "FORBIDDEN" (`AuthErrorShape`), which
 *   `@/server/errors` recognises by shape (no class import needed);
 * - `mustChangePassword` users get FORBIDDEN unless
 *   `allowPendingPasswordChange` is true.
 */

import "server-only";

import type { AuthApi, AuthErrorShape } from "@/contracts/auth";

export type AuthGate = Pick<AuthApi, "requireRole" | "requireSession">;

class AuthNotConfiguredError extends Error implements AuthErrorShape {
  override readonly name = "AuthError" as const;
  readonly code = "UNAUTHENTICATED" as const;
  constructor() {
    super("Authentication is not configured yet (web/src/auth pending).");
  }
}

export const requireRole: AuthGate["requireRole"] = async () => {
  throw new AuthNotConfiguredError();
};

export const requireSession: AuthGate["requireSession"] = async () => {
  throw new AuthNotConfiguredError();
};
