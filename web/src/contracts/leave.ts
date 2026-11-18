/**
 * Leave domain contract. Implemented by Backend in web/src/server/leave/.
 * Business rules: docs/architecture/contracts.md#leave
 */

import type {
  Actor,
  IsoDate,
  LeaveRequestId,
  Timestamp,
} from "./common";
import type { EmployeeRef } from "./employee";

/**
 * Leave types. Legacy stored the label text; the migration maps
 * "Sick Leave" -> SICK etc. and anything unrecognised -> OTHER.
 */
export const LEAVE_TYPES = [
  "SICK",
  "ANNUAL",
  "CASUAL",
  "MATERNITY",
  "UNPAID",
  "OTHER",
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

/** Types a new request may use. OTHER exists only on migrated rows. */
export const REQUESTABLE_LEAVE_TYPES = [
  "SICK",
  "ANNUAL",
  "CASUAL",
  "MATERNITY",
  "UNPAID",
] as const satisfies readonly LeaveType[];
export type RequestableLeaveType = (typeof REQUESTABLE_LEAVE_TYPES)[number];

/** Display labels (same wording as the legacy form). */
export const LEAVE_TYPE_LABELS: Readonly<Record<LeaveType, string>> = {
  SICK: "Sick Leave",
  ANNUAL: "Annual Leave",
  CASUAL: "Casual Leave",
  MATERNITY: "Maternity Leave",
  UNPAID: "Unpaid Leave",
  OTHER: "Other",
};

/** Legacy `empleave.status`: 0 = pending, 1 = approved, 2 = rejected. */
export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/** The only transitions allowed: PENDING -> APPROVED | REJECTED. */
export type LeaveDecision = Exclude<LeaveStatus, "PENDING">;

export interface LeaveRequest {
  id: LeaveRequestId;
  /** "Unknown employee #<id>" for placeholder employees (legacy orphans). */
  employee: EmployeeRef;
  leaveType: LeaveType;
  /**
   * Original legacy text, read-only. Set only on migrated rows mapped to
   * OTHER, and only returned to HR_ADMIN (null in an employee's own list).
   * The UI shows it next to "Other".
   */
  legacyLeaveType: string | null;
  /**
   * null only on migrated rows whose legacy text could not be parsed
   * (ADR-0007). The UI shows "—"; new requests always have both dates.
   */
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  reason: string | null;
  status: LeaveStatus;
  /**
   * Legacy `read`. false when HR has decided and the employee has not yet
   * opened their leave history. Always true while PENDING.
   */
  seenByEmployee: boolean;
  createdAt: Timestamp | null; // null for migrated rows
  decidedAt: Timestamp | null;
}

export interface ApplyForLeaveInput {
  leaveType: RequestableLeaveType;
  startDate: IsoDate;
  endDate: IsoDate; // >= startDate
  reason?: string | null; // 0..1000
}

export interface LeaveService {
  /**
   * EMPLOYEE (legacy parity; HR leave is out of scope until after cutover).
   * Creates a PENDING request for actor.employeeId.
   * Throws VALIDATION (incl. OTHER); FORBIDDEN if the account has no
   * employee record.
   */
  applyForLeave(
    actor: Actor,
    input: ApplyForLeaveInput,
  ): Promise<LeaveRequest>;

  /** EMPLOYEE. Own requests, newest first. Pure read (does not mark seen). */
  listMyLeaveRequests(actor: Actor): Promise<LeaveRequest[]>;

  /**
   * EMPLOYEE. Marks the actor's decided-but-unseen requests as seen.
   * The leave-history page calls this once after it renders (legacy did it
   * inside the GET handler). Returns how many rows changed.
   */
  markMyLeaveDecisionsSeen(actor: Actor): Promise<number>;

  /** EMPLOYEE. Count for the dashboard notification. */
  countMyUnseenDecisions(actor: Actor): Promise<number>;

  /** HR_ADMIN. PENDING requests, oldest first (the approval queue). */
  listPendingLeaveRequests(actor: Actor): Promise<LeaveRequest[]>;

  /** HR_ADMIN. All requests (placeholder history included), newest first. */
  listAllLeaveRequests(actor: Actor): Promise<LeaveRequest[]>;

  /** HR_ADMIN. Count for the dashboard notification. */
  countPendingLeaveRequests(actor: Actor): Promise<number>;

  /**
   * HR_ADMIN. PENDING -> decision; sets decidedAt, decidedBy,
   * seenByEmployee=false. Throws NOT_FOUND; CONFLICT if already decided.
   * (Terminating an employee rejects their PENDING requests automatically.)
   */
  decideLeaveRequest(
    actor: Actor,
    id: LeaveRequestId,
    decision: LeaveDecision,
  ): Promise<LeaveRequest>;
}
