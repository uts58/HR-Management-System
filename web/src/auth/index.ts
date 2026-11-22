import "server-only";

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
export { accountAdmin, setInitialPassword } from "./account-admin";

const _authApi: AuthApi = { getSession, requireSession, requireRole };
void _authApi;
