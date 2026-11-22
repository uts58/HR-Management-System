/**
 * Leave domain contract. Implemented in web/src/server/leave/.
 * Business rules: docs/architecture/contracts.md#leave
 */

import type { Actor, IsoDate, LeaveRequestId, UtcTimestamp } from "./common";
import type { EmployeeRef } from "./employee";

/** Leave types. */
export const LEAVE_TYPES = [
  "SICK",
  "ANNUAL",
  "CASUAL",
  "MATERNITY",
  "UNPAID",
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

/** Display labels. */
export const LEAVE_TYPE_LABELS: Readonly<Record<LeaveType, string>> = {
  SICK: "Sick Leave",
  ANNUAL: "Annual Leave",
  CASUAL: "Casual Leave",
  MATERNITY: "Maternity Leave",
  UNPAID: "Unpaid Leave",
};

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/** The only transitions allowed: PENDING -> APPROVED | REJECTED. */
export type LeaveDecision = Exclude<LeaveStatus, "PENDING">;

export interface LeaveRequest {
  id: LeaveRequestId;
  employee: EmployeeRef;
  leaveType: LeaveType;
  /** New requests always have both dates; the UI shows "—" for null. */
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  reason: string | null;
  status: LeaveStatus;
  /**
   * false when HR has decided and the employee has not yet
   * opened their leave history. Always true while PENDING.
   */
  seenByEmployee: boolean;
  createdAt: UtcTimestamp | null;
  decidedAt: UtcTimestamp | null;
}

export interface ApplyForLeaveInput {
  leaveType: LeaveType;
  startDate: IsoDate;
  endDate: IsoDate; // >= startDate
  reason?: string | null; // 0..1000
}

export interface LeaveService {
  /**
   * EMPLOYEE.
   * Creates a PENDING request for actor.employeeId.
   * Throws VALIDATION (incl. OTHER); FORBIDDEN if the account has no
   * employee record.
   */
  applyForLeave(actor: Actor, input: ApplyForLeaveInput): Promise<LeaveRequest>;

  /** EMPLOYEE. Own requests, newest first. Pure read (does not mark seen). */
  listMyLeaveRequests(actor: Actor): Promise<LeaveRequest[]>;

  /**
   * EMPLOYEE. Marks the actor's decided-but-unseen requests as seen.
   * The leave-history page calls this once after it renders. Returns how many rows changed.
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
