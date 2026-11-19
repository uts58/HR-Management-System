import "server-only";

/**
 * @/auth — the server-side auth API (contract web/src/contracts/auth.ts,
 * ADR-0004). Nothing outside web/src/auth imports better-auth.
 *
 * Other entry points in this folder:
 * - "@/auth/actions": changePassword, signOut (server actions)
 * - "@/auth/client":  signInWithUsername (browser; login form only)
 */

import type { AuthApi } from "@/contracts";
import { getSession, requireRole, requireSession } from "./session";

export { Role } from "@/contracts";
export type {
  AccountAdminApi,
  AuthFailure,
  IssuedCredentials,
  RequireOptions,
  Session,
  SessionUser,
} from "@/contracts";

export { getSession, requireRole, requireSession };
export { AuthError, isAuthError } from "./errors";
export { accountAdmin } from "./account-admin";

// Compile-time check that the exports match the contract.
const _authApi: AuthApi = { getSession, requireSession, requireRole };
void _authApi;
