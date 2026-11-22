import type { Role } from "./auth";

export type EmployeeId = number;

export type UserId = string;

export type DepartmentId = number;
export type PositionId = number;
export type LeaveRequestId = number;
export type NoticeId = number;
export type AppraisalId = number;

export type IsoDate = string & { readonly __brand: "IsoDate" };

export type UtcTimestamp = string & { readonly __brand: "UtcTimestamp" };

export const ERROR_CODES = [
  "VALIDATION", // input failed Zod or a business rule tied to a field
  "UNAUTHENTICATED", // no valid session
  "FORBIDDEN", // signed in but not allowed
  "NOT_FOUND", // target does not exist (or is hidden from this actor)
  "CONFLICT", // state forbids the change (duplicate, already decided, in use)
  "INTERNAL", // anything unexpected; generic message, details only logged
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type FieldErrors = Partial<Record<string, string[]>>;

export interface AppError {
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
}

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: AppError };

export interface ServiceErrorShape {
  readonly name: "ServiceError";
  readonly code: Exclude<ErrorCode, "UNAUTHENTICATED" | "INTERNAL">;
  readonly message: string;
  readonly fieldErrors?: FieldErrors;
}

export interface Actor {
  userId: UserId;
  employeeId: EmployeeId | null;
  role: Role;
}

export interface Option<TId extends string | number = number> {
  id: TId;
  label: string;
}
