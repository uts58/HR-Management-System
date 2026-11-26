import type { Actor, IsoDate, LeaveRequestId, UtcTimestamp } from "./common";
import type { EmployeeRef } from "./employee";

export const LEAVE_TYPES = [
  "SICK",
  "ANNUAL",
  "CASUAL",
  "MATERNITY",
  "UNPAID",
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_TYPE_LABELS: Readonly<Record<LeaveType, string>> = {
  SICK: "Sick Leave",
  ANNUAL: "Annual Leave",
  CASUAL: "Casual Leave",
  MATERNITY: "Maternity Leave",
  UNPAID: "Unpaid Leave",
};

export const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export type LeaveDecision = Exclude<LeaveStatus, "PENDING">;

export interface LeaveRequest {
  id: LeaveRequestId;
  employee: EmployeeRef;
  leaveType: LeaveType;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  reason: string | null;
  status: LeaveStatus;
  seenByEmployee: boolean;
  createdAt: UtcTimestamp;
  decidedAt: UtcTimestamp | null;
  /** The requester decided it themselves (sole active HR admin exception). */
  selfApproved: boolean;
}

export interface ApplyForLeaveInput {
  leaveType: LeaveType;
  startDate: IsoDate;
  endDate: IsoDate;
  reason?: string | null;
}

export interface LeaveService {
  applyForLeave(actor: Actor, input: ApplyForLeaveInput): Promise<LeaveRequest>;

  listMyLeaveRequests(actor: Actor): Promise<LeaveRequest[]>;

  markMyLeaveDecisionsSeen(actor: Actor): Promise<number>;

  countMyUnseenDecisions(actor: Actor): Promise<number>;

  listPendingLeaveRequests(actor: Actor): Promise<LeaveRequest[]>;

  listAllLeaveRequests(actor: Actor): Promise<LeaveRequest[]>;

  countPendingLeaveRequests(actor: Actor): Promise<number>;

  /** True when the actor is the only active HR admin and so may decide their own requests. */
  canDecideOwnLeave(actor: Actor): Promise<boolean>;

  decideLeaveRequest(
    actor: Actor,
    id: LeaveRequestId,
    decision: LeaveDecision,
  ): Promise<LeaveRequest>;
}
