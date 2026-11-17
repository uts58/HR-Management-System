/**
 * Leave domain contract. Implemented by Backend in web/src/server/leave/.
 * Business rules: docs/architecture/contracts.md#leave
 */

import type { Actor, EmployeeId, IsoDate, LeaveRequestId, Timestamp } from './common';

/** Legacy free-text values from the leave form, stored verbatim. */
export const LEAVE_TYPES = [
  'Sick Leave',
  'Annual Leave',
  'Casual Leave',
  'Maternity Leave',
  'Unpaid Leave',
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

/** Legacy `empleave.status`: 0 = pending, 1 = approved, 2 = rejected. */
export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/** The only transitions allowed: PENDING -> APPROVED | REJECTED. */
export type LeaveDecision = Exclude<LeaveStatus, 'PENDING'>;

export interface LeaveRequest {
  id: LeaveRequestId;
  employeeId: EmployeeId;
  /** "First Last"; "Unknown employee" if the record is gone (legacy orphan rows). */
  employeeName: string;
  /** string, not LeaveType: migrated rows may contain other values. */
  leaveType: string;
  startDate: IsoDate | null; // null only for legacy rows whose text could not be parsed
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
  leaveType: LeaveType;
  startDate: IsoDate;
  endDate: IsoDate; // >= startDate
  reason?: string | null; // 0..1000
}

export interface LeaveService {
  /**
   * EMPLOYEE (legacy parity: HR has no leave form; see Open questions).
   * Creates a PENDING request for actor.employeeId.
   * Throws VALIDATION; FORBIDDEN if the account has no employee record.
   */
  applyForLeave(actor: Actor, input: ApplyForLeaveInput): Promise<LeaveRequest>;

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

  /** HR_ADMIN. All requests, newest first. */
  listAllLeaveRequests(actor: Actor): Promise<LeaveRequest[]>;

  /** HR_ADMIN. Count for the dashboard notification. */
  countPendingLeaveRequests(actor: Actor): Promise<number>;

  /**
   * HR_ADMIN. PENDING -> decision; sets decidedAt, decidedBy, seenByEmployee=false.
   * Throws NOT_FOUND; CONFLICT if already decided.
   */
  decideLeaveRequest(
    actor: Actor,
    id: LeaveRequestId,
    decision: LeaveDecision,
  ): Promise<LeaveRequest>;
}
