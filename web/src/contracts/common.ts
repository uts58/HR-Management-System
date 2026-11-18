/**
 * Shared primitives for all service contracts.
 *
 * Rules for everything under web/src/contracts/ (see ADR-0003, ADR-0006):
 * - Framework-agnostic: no imports from next, better-auth, Prisma, zod or
 *   react.
 * - Type-only, except `as const` tuples/objects that model enums. These
 *   exist so that Zod schemas (web/src/lib/validation) and UI selects use
 *   the same values.
 * - No logic.
 */

import type { Role } from "./auth";

// ─── Identifiers ────────────────────────────────────────────────────────────

/** Employee primary key. Legacy `employee.id` (Int) is kept by the migration. */
export type EmployeeId = number;

/** Login account primary key. Opaque string (Better Auth user id). */
export type UserId = string;

export type DepartmentId = number;
export type PositionId = number;
export type LeaveRequestId = number;
export type NoticeId = number;
export type AppraisalId = number;

// ─── Dates (ADR-0007) ───────────────────────────────────────────────────────

/**
 * Calendar date with no time or zone, formatted `YYYY-MM-DD`.
 * Used for date of birth, leave start/end and project begin/end.
 * Never pass these through `new Date(...)` for arithmetic or display: a zone
 * shift can move the day. Use the helpers in web/src/lib/dates.ts.
 */
export type IsoDate = string & { readonly __brand: "IsoDate" };

/**
 * A point in time (createdAt, decidedAt). Stored as timestamptz (UTC).
 * Displayed in the viewer's browser time zone; APP_TIME_ZONE only defines
 * the business day (ADR-0007).
 */
export type Timestamp = Date;

// ─── Errors and results (ADR-0006) ──────────────────────────────────────────

export const ERROR_CODES = [
  "VALIDATION", // input failed Zod or a business rule tied to a field
  "UNAUTHENTICATED", // no valid session
  "FORBIDDEN", // signed in but not allowed
  "NOT_FOUND", // target does not exist (or is hidden from this actor)
  "CONFLICT", // state forbids the change (duplicate, already decided, in use)
  "INTERNAL", // anything unexpected; generic message, details only logged
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Field name -> messages. Keys match form field / input property names. */
export type FieldErrors = Partial<Record<string, string[]>>;

export interface AppError {
  code: ErrorCode;
  /** Safe to show to the user. Never contains stack traces, SQL or secrets. */
  message: string;
  fieldErrors?: FieldErrors;
}

/**
 * What every server action returns to the client.
 * Services throw; actions return this.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

/**
 * Shape of the error class services throw (Backend implements it in
 * web/src/server/errors.ts as
 * `class ServiceError extends Error implements ServiceErrorShape`).
 */
export interface ServiceErrorShape {
  readonly name: "ServiceError";
  readonly code: Exclude<ErrorCode, "UNAUTHENTICATED" | "INTERNAL">;
  readonly message: string;
  readonly fieldErrors?: FieldErrors;
}

// ─── Actor ──────────────────────────────────────────────────────────────────

/**
 * Who is calling a service. Built by the server action from the session
 * that `requireRole()` returns, and passed as the first argument to every
 * service function. Services never read cookies or call getSession()
 * themselves, which keeps them testable with plain Vitest.
 */
export interface Actor {
  userId: UserId;
  /** null only for accounts with no employee record. */
  employeeId: EmployeeId | null;
  role: Role;
}

// ─── Misc ───────────────────────────────────────────────────────────────────

/** Small {id, label} pair for selects (department, position, employee). */
export interface Option<TId extends string | number = number> {
  id: TId;
  label: string;
}
