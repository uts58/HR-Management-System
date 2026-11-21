import "server-only";

import type {
  AuthErrorShape,
  AuthFailure,
  FieldErrors,
  ServiceErrorShape,
} from "@/contracts";

/** Thrown by requireSession/requireRole in 'throw' mode (contract AuthErrorShape). */
export class AuthError extends Error implements AuthErrorShape {
  override readonly name = "AuthError" as const;
  readonly code: AuthFailure;

  constructor(code: AuthFailure, message?: string) {
    super(
      message ??
        (code === "UNAUTHENTICATED"
          ? "Please sign in."
          : "You don't have permission to do that."),
    );
    this.code = code;
  }
}

export function isAuthError(err: unknown): err is AuthError {
  return (
    err instanceof AuthError ||
    (typeof err === "object" &&
      err !== null &&
      (err as { name?: unknown }).name === "AuthError" &&
      ((err as { code?: unknown }).code === "UNAUTHENTICATED" ||
        (err as { code?: unknown }).code === "FORBIDDEN"))
  );
}

/**
 * Error thrown by AccountAdminApi and the auth actions (VALIDATION,
 * CONFLICT on a taken username, NOT_FOUND for an unknown user). It has the
 * ServiceErrorShape (`name: "ServiceError"`), and web/src/server/errors.ts
 * recognises errors by shape, so runAction maps it exactly like Backend's
 * ServiceError. (auth/ does not import server/errors; ADR-0002 import table.)
 */
export class AuthServiceError extends Error implements ServiceErrorShape {
  override readonly name = "ServiceError" as const;
  readonly code: ServiceErrorShape["code"];
  readonly fieldErrors?: FieldErrors;

  constructor(
    code: ServiceErrorShape["code"],
    message: string,
    fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.code = code;
    if (fieldErrors) this.fieldErrors = fieldErrors;
  }
}
