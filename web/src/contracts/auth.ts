import type { ActionResult, EmployeeId, UserId } from "./common";

export const Role = {
  HR_ADMIN: "HR_ADMIN",
  EMPLOYEE: "EMPLOYEE",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export interface SessionUser {
  userId: UserId;
  employeeId: EmployeeId | null;
  username: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface Session {
  user: SessionUser;
  expires: string;
}

export type AuthFailure = "UNAUTHENTICATED" | "FORBIDDEN";

export interface AuthErrorShape {
  readonly name: "AuthError";
  readonly code: AuthFailure;
  readonly message: string;
}

export interface RequireOptions {
  onFail?: "throw" | "redirect";
  allowPendingPasswordChange?: boolean;
}

export interface AuthApi {
  getSession(): Promise<Session | null>;

  requireSession(options?: RequireOptions): Promise<Session>;

  requireRole(
    role: Role | readonly Role[],
    options?: RequireOptions,
  ): Promise<Session>;
}

export interface IssuedCredentials {
  username: string;
  temporaryPassword: string;
}

export interface CreateLoginAccountInput {
  employeeId: EmployeeId;
  username: string;
  displayName: string;
  email?: string | null;
  role: Role;
}

export interface AuthUserAdditionalFields {
  role: Role;
  mustChangePassword: boolean;
  employeeId: EmployeeId | null;
  disabledAt: Date | null;
  emailIsPlaceholder: boolean;
}

export interface AccountAdminApi {
  createLoginAccount<Tx>(
    tx: Tx,
    input: CreateLoginAccountInput,
  ): Promise<{ userId: UserId; credentials: IssuedCredentials }>;

  issueTemporaryPassword<Tx>(
    tx: Tx,
    userId: UserId,
  ): Promise<IssuedCredentials>;

  disableLogin<Tx>(tx: Tx, userId: UserId): Promise<void>;

  updateDisplayName<Tx>(tx: Tx, userId: UserId, name: string): Promise<void>;
}

export interface SignInInput {
  username: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AuthClientApi {
  signInWithUsername(
    input: SignInInput,
  ): Promise<ActionResult<{ redirectTo: string }>>;
}

export interface AuthActions {
  signOut(): Promise<void>;

  changePassword(input: ChangePasswordInput): Promise<ActionResult>;
}
