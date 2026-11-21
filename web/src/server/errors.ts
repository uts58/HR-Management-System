/**
 * Domain errors and their mapping to `ActionResult` (ADR-0006).
 *
 * Services throw `ServiceError`; `runAction` (and `defineAction`, built on
 * it) turns anything thrown into `{ ok: false, error }` with a user-safe
 * message. Next.js control-flow errors (redirect, notFound, forbidden, …)
 * are rethrown untouched via `unstable_rethrow` (the Next 16 API name).
 *
 * Prisma and auth errors are recognised by shape (`name` + `code`), not by
 * `instanceof`, so this module needs neither the generated Prisma client
 * nor `@/auth`, and duplicate module copies cannot defeat the checks.
 */

import "server-only";

import { unstable_rethrow } from "next/navigation";
import { ZodError, z } from "zod";
import type { AuthErrorShape, AuthFailure } from "@/contracts/auth";
import type {
  ActionResult,
  AppError,
  FieldErrors,
  ServiceErrorShape,
} from "@/contracts/common";

// ─── ServiceError ───────────────────────────────────────────────────────────

export type ServiceErrorCode = ServiceErrorShape["code"];

const DEFAULT_MESSAGES: Record<ServiceErrorCode, string> = {
  VALIDATION: "Please correct the highlighted fields.",
  FORBIDDEN: "You do not have permission to do that.",
  NOT_FOUND: "The requested record was not found.",
  CONFLICT: "This change conflicts with the current state of the record.",
};

export const INTERNAL_ERROR_MESSAGE = "Something went wrong. Please try again.";
const UNAUTHENTICATED_MESSAGE = "Your session has ended. Please sign in again.";

/**
 * The only error services throw on purpose. `message` must be safe to show
 * to the user; `fieldErrors` keys are input property names.
 */
export class ServiceError extends Error implements ServiceErrorShape {
  override readonly name = "ServiceError" as const;
  readonly code: ServiceErrorCode;
  readonly fieldErrors?: FieldErrors;

  constructor(
    code: ServiceErrorCode,
    message: string = DEFAULT_MESSAGES[code],
    fieldErrors?: FieldErrors,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.code = code;
    if (fieldErrors) this.fieldErrors = fieldErrors;
  }
}

/** `NOT_FOUND`, e.g. `notFoundError("Employee not found")`. */
export function notFoundError(message?: string): ServiceError {
  return new ServiceError("NOT_FOUND", message);
}

/** `FORBIDDEN` from a service-level role or ownership check. */
export function forbiddenError(message?: string): ServiceError {
  return new ServiceError("FORBIDDEN", message);
}

/**
 * `CONFLICT`. With `field`, the message is also attached to that form
 * field (e.g. a duplicate department name on `name`).
 */
export function conflictError(
  message: string,
  field?: string,
  options?: { cause?: unknown },
): ServiceError {
  return new ServiceError(
    "CONFLICT",
    message,
    field ? { [field]: [message] } : undefined,
    options,
  );
}

/**
 * `VALIDATION` for rules the schema cannot check (unknown department,
 * date of birth vs the company's today, terminated employee picked, …).
 */
export function validationError(
  fieldErrors: FieldErrors,
  message: string = DEFAULT_MESSAGES.VALIDATION,
): ServiceError {
  return new ServiceError("VALIDATION", message, fieldErrors);
}

/** Single-field shorthand: `fieldValidationError("employeeId", "…")`. */
export function fieldValidationError(
  field: string,
  message: string,
): ServiceError {
  return validationError({ [field]: [message] });
}

const SERVICE_CODES = new Set<string>(Object.keys(DEFAULT_MESSAGES));

export function isServiceError(e: unknown): e is ServiceErrorShape {
  if (e instanceof ServiceError) return true;
  return (
    e instanceof Error &&
    e.name === "ServiceError" &&
    SERVICE_CODES.has((e as { code?: unknown }).code as string)
  );
}

// ─── AuthError (thrown by @/auth requireRole/requireSession) ────────────────

const AUTH_CODES = new Set<AuthFailure>(["UNAUTHENTICATED", "FORBIDDEN"]);

export function isAuthError(e: unknown): e is AuthErrorShape {
  return (
    e instanceof Error &&
    e.name === "AuthError" &&
    AUTH_CODES.has((e as { code?: unknown }).code as AuthFailure)
  );
}

// ─── Prisma errors (duck-typed) ─────────────────────────────────────────────

interface PrismaKnownErrorLike {
  name: "PrismaClientKnownRequestError";
  code: string;
  message: string;
  meta?: Record<string, unknown>;
}

export function isPrismaKnownError(
  e: unknown,
  code?: string,
): e is PrismaKnownErrorLike {
  if (!(e instanceof Error) || e.name !== "PrismaClientKnownRequestError") {
    return false;
  }
  const actual = (e as { code?: unknown }).code;
  return typeof actual === "string" && (code === undefined || actual === code);
}

/**
 * True for a Prisma P2003 foreign-key violation. Deliberately NOT mapped
 * globally (it stays INTERNAL, ADR-0006): only delete services that can hit
 * a Restrict FK catch it and convert it to CONFLICT with their own message.
 */
export function isForeignKeyViolation(e: unknown): boolean {
  return isPrismaKnownError(e, "P2003");
}

/** What a unique violation tells us about the constraint it hit. */
export interface UniqueViolation {
  /** Index/constraint name, e.g. "departments_name_lower_key". */
  constraint?: string;
  /** Column names, when the driver reports them. */
  fields?: string[];
}

const unquote = (s: string) => s.trim().replace(/^"|"$/g, "");

/**
 * Details of a Prisma P2002 unique violation, or null for any other error.
 *
 * Prisma 7 with `@prisma/adapter-pg` puts the driver error under
 * `meta.driverAdapterError.cause`: `constraint` is `{ index }` when
 * Postgres names the constraint (always, in practice) or `{ fields }`.
 * Expression indexes such as `lower(name)` only give a usable index name,
 * so callers match on the constraint name. Older engines put `target`
 * (string or string[]) on `meta` directly; both are handled.
 */
export function getUniqueViolation(e: unknown): UniqueViolation | null {
  if (!isPrismaKnownError(e, "P2002")) return null;
  const meta = e.meta ?? {};
  const result: UniqueViolation = {};

  const cause = (meta.driverAdapterError as { cause?: unknown } | undefined)
    ?.cause as
    | {
        constraint?: { index?: unknown; fields?: unknown };
        originalMessage?: unknown;
      }
    | undefined;

  const index = cause?.constraint?.index;
  if (typeof index === "string") result.constraint = index;
  const fields = cause?.constraint?.fields;
  if (Array.isArray(fields)) result.fields = fields.map(String).map(unquote);

  if (!result.constraint && typeof cause?.originalMessage === "string") {
    const m = /unique constraint "([^"]+)"/i.exec(cause.originalMessage);
    if (m?.[1]) result.constraint = m[1];
  }

  const target = meta.target;
  if (typeof target === "string") {
    // Engine form: the constraint name, or a column list.
    if (!result.constraint) result.constraint = target;
  } else if (Array.isArray(target) && !result.fields) {
    result.fields = target.map(String).map(unquote);
  }
  return result;
}

/** How a known unique constraint maps to a form field. */
export interface UniqueConstraintRule {
  field: string;
  message: string;
}

/**
 * Unique constraints services must report on a field (ADR-0006: "services
 * handle the known ones"). Names come from Data's init migration:
 * the `lower(name)` indexes are hand-written, so their violation names no
 * column and is identified by constraint name only.
 */
export const KNOWN_UNIQUE_CONSTRAINTS = {
  departments_name_lower_key: {
    field: "name",
    message: "A department with this name already exists",
  },
  positions_name_lower_key: {
    field: "name",
    message: "A position with this name already exists",
  },
  users_username_key: {
    field: "username",
    message: "This username is already taken",
  },
} as const satisfies Record<string, UniqueConstraintRule>;

export type KnownUniqueConstraint = keyof typeof KNOWN_UNIQUE_CONSTRAINTS;

/**
 * Turn a P2002 into `CONFLICT` on the right field, if it is one of `rules`
 * (default: all KNOWN_UNIQUE_CONSTRAINTS). Matches by constraint name only:
 * a bare column name such as `name` cannot tell departments from positions.
 * Returns null if `e` is not a matching unique violation, so callers can
 * rethrow:
 *
 *   } catch (e) {
 *     throw uniqueViolationToConflict(e, ["departments_name_lower_key"]) ?? e;
 *   }
 */
export function uniqueViolationToConflict(
  e: unknown,
  only?: readonly KnownUniqueConstraint[],
): ServiceError | null {
  const violation = getUniqueViolation(e);
  if (!violation) return null;
  const names =
    only ?? (Object.keys(KNOWN_UNIQUE_CONSTRAINTS) as KnownUniqueConstraint[]);

  const byName = names.find((n) => n === violation.constraint);
  if (byName) {
    const rule = KNOWN_UNIQUE_CONSTRAINTS[byName];
    return conflictError(rule.message, rule.field, { cause: e });
  }
  return null;
}

// ─── Mapping to ActionResult ────────────────────────────────────────────────

/** `z.flattenError` field errors, dropping empty entries. */
function zodFieldErrors(e: ZodError): {
  fieldErrors: FieldErrors;
  formErrors: string[];
} {
  const flat = z.flattenError(e);
  const fieldErrors: FieldErrors = {};
  for (const [k, v] of Object.entries(flat.fieldErrors) as [
    string,
    string[] | undefined,
  ][]) {
    if (v && v.length > 0) fieldErrors[k] = v;
  }
  return { fieldErrors, formErrors: flat.formErrors };
}

export type ErrorLogger = (entry: Record<string, unknown>) => void;

/** Structured JSON to stdout/stderr (ADR-0006 rule 6). Never logs input. */
export const defaultErrorLogger: ErrorLogger = (entry) => {
  console.error(JSON.stringify(entry));
};

function describeError(e: unknown): Record<string, unknown> {
  if (e instanceof Error) {
    const code: unknown = (e as { code?: unknown }).code;
    return {
      name: e.name,
      message: e.message,
      ...(typeof code === "string" ? { code } : {}),
      stack: e.stack,
    };
  }
  return { thrown: typeof e };
}

/**
 * Map any thrown value to a user-safe `AppError` (ADR-0006 table).
 * Unexpected errors are logged with a request id and become INTERNAL with a
 * generic message: no stack, SQL or internals ever reach the client.
 */
export function toAppError(
  e: unknown,
  log: ErrorLogger = defaultErrorLogger,
): AppError {
  if (e instanceof ZodError) {
    const { fieldErrors, formErrors } = zodFieldErrors(e);
    return {
      code: "VALIDATION",
      message: formErrors[0] ?? DEFAULT_MESSAGES.VALIDATION,
      fieldErrors,
    };
  }

  if (isServiceError(e)) {
    return {
      code: e.code,
      message: e.message,
      ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}),
    };
  }

  if (isAuthError(e)) {
    return {
      code: e.code,
      message:
        e.code === "UNAUTHENTICATED"
          ? UNAUTHENTICATED_MESSAGE
          : DEFAULT_MESSAGES.FORBIDDEN,
    };
  }

  if (isPrismaKnownError(e, "P2002")) {
    const known = uniqueViolationToConflict(e);
    if (known) return toAppError(known, log);
    return {
      code: "CONFLICT",
      message: "A record with these details already exists.",
    };
  }

  if (isPrismaKnownError(e, "P2025")) {
    return { code: "NOT_FOUND", message: DEFAULT_MESSAGES.NOT_FOUND };
  }

  const requestId = crypto.randomUUID();
  log({
    level: "error",
    time: new Date().toISOString(),
    msg: "Unhandled error in server action",
    requestId,
    error: describeError(e),
  });
  return { code: "INTERNAL", message: INTERNAL_ERROR_MESSAGE };
}

/** `toAppError` wrapped as a failed `ActionResult`. */
export function toActionResult(
  e: unknown,
  log?: ErrorLogger,
): ActionResult<never> {
  return { ok: false, error: toAppError(e, log) };
}

/**
 * Run `fn` and return its value as an `ActionResult`. Never throws, except
 * for Next.js control-flow errors (redirect/notFound/forbidden/…), which
 * must reach the framework.
 */
export async function runAction<T>(
  fn: () => Promise<T> | T,
  log?: ErrorLogger,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    unstable_rethrow(e);
    return toActionResult(e, log);
  }
}
