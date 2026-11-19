/**
 * Leave requests (contracts.md#leave).
 *
 * - Only EMPLOYEE applies (legacy parity); the employee id always comes from
 *   the actor, never from input.
 * - Decisions only from PENDING, with a conditional update so two HR users
 *   deciding at once can't both win: the loser gets CONFLICT.
 * - Reads have no side effects; marking decisions seen is its own call.
 * - Migrated rows may have null dates (shown as "—") and null createdAt
 *   (ordered as the oldest).
 */

import "server-only";

import { Role } from "@/contracts/auth";
import type { Actor, LeaveRequestId } from "@/contracts/common";
import type {
  LeaveDecision,
  LeaveRequest,
  LeaveService,
} from "@/contracts/leave";
import type { Prisma } from "@/generated/prisma/client";
import {
  isoDateToUtcDate,
  toIsoDateOrNull,
  toIsoInstantOrNull,
} from "@/lib/dates";
import {
  applyForLeaveSchema,
  decideLeaveRequestSchema,
} from "@/lib/validation/leave";
import { db } from "../db";
import { conflictError, notFoundError } from "../errors";
import {
  assertRole,
  employeeRefSelect,
  newestFirst,
  oldestFirst,
  requireOwnEmployeeId,
  toEmployeeRef,
} from "../shared";

export const ALREADY_DECIDED_MESSAGE =
  "This leave request has already been decided.";

const leaveSelect = {
  id: true,
  leaveType: true,
  legacyLeaveType: true,
  startDate: true,
  endDate: true,
  reason: true,
  status: true,
  seenByEmployee: true,
  createdAt: true,
  decidedAt: true,
  employee: { select: employeeRefSelect },
} as const satisfies Prisma.LeaveRequestSelect;

type LeaveRow = Prisma.LeaveRequestGetPayload<{ select: typeof leaveSelect }>;

/** `legacyLeaveType` is only shown to HR (contract rule 1). */
function toLeaveRequest(r: LeaveRow, forHr: boolean): LeaveRequest {
  return {
    id: r.id,
    employee: toEmployeeRef(r.employee),
    leaveType: r.leaveType,
    legacyLeaveType: forHr ? r.legacyLeaveType : null,
    startDate: toIsoDateOrNull(r.startDate),
    endDate: toIsoDateOrNull(r.endDate),
    reason: r.reason,
    status: r.status,
    seenByEmployee: r.seenByEmployee,
    createdAt: toIsoInstantOrNull(r.createdAt),
    decidedAt: toIsoInstantOrNull(r.decidedAt),
  };
}

const unseenDecisions = (employeeId: number) =>
  ({
    employeeId,
    status: { not: "PENDING" },
    seenByEmployee: false,
  }) satisfies Prisma.LeaveRequestWhereInput;

export const leaveService: LeaveService = {
  async applyForLeave(actor: Actor, raw) {
    assertRole(actor, Role.EMPLOYEE);
    const employeeId = requireOwnEmployeeId(actor);
    const input = applyForLeaveSchema.parse(raw);
    const row = await db.leaveRequest.create({
      data: {
        employeeId,
        leaveType: input.leaveType,
        startDate: isoDateToUtcDate(input.startDate),
        endDate: isoDateToUtcDate(input.endDate),
        reason: input.reason ?? null,
        status: "PENDING",
        seenByEmployee: true,
      },
      select: leaveSelect,
    });
    return toLeaveRequest(row, false);
  },

  async listMyLeaveRequests(actor) {
    assertRole(actor, Role.EMPLOYEE);
    const employeeId = requireOwnEmployeeId(actor);
    const rows = await db.leaveRequest.findMany({
      where: { employeeId },
      select: leaveSelect,
      orderBy: newestFirst(),
    });
    return rows.map((r) => toLeaveRequest(r, false));
  },

  async markMyLeaveDecisionsSeen(actor) {
    assertRole(actor, Role.EMPLOYEE);
    const employeeId = requireOwnEmployeeId(actor);
    const { count } = await db.leaveRequest.updateMany({
      where: unseenDecisions(employeeId),
      data: { seenByEmployee: true },
    });
    return count;
  },

  async countMyUnseenDecisions(actor) {
    assertRole(actor, Role.EMPLOYEE);
    const employeeId = requireOwnEmployeeId(actor);
    return db.leaveRequest.count({ where: unseenDecisions(employeeId) });
  },

  async listPendingLeaveRequests(actor) {
    assertRole(actor, Role.HR_ADMIN);
    const rows = await db.leaveRequest.findMany({
      where: { status: "PENDING" },
      select: leaveSelect,
      orderBy: oldestFirst(),
    });
    return rows.map((r) => toLeaveRequest(r, true));
  },

  async listAllLeaveRequests(actor) {
    assertRole(actor, Role.HR_ADMIN);
    const rows = await db.leaveRequest.findMany({
      select: leaveSelect,
      orderBy: newestFirst(),
    });
    return rows.map((r) => toLeaveRequest(r, true));
  },

  async countPendingLeaveRequests(actor) {
    assertRole(actor, Role.HR_ADMIN);
    return db.leaveRequest.count({ where: { status: "PENDING" } });
  },

  async decideLeaveRequest(
    actor,
    rawId: LeaveRequestId,
    rawDecision: LeaveDecision,
  ) {
    assertRole(actor, Role.HR_ADMIN);
    const { id, decision } = decideLeaveRequestSchema.parse({
      id: rawId,
      decision: rawDecision,
    });
    return db.$transaction(async (tx) => {
      // Conditional update: only a PENDING row changes, so it is atomic.
      const { count } = await tx.leaveRequest.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: decision,
          decidedAt: new Date(),
          decidedById: actor.userId,
          seenByEmployee: false,
        },
      });
      const row = await tx.leaveRequest.findUnique({
        where: { id },
        select: leaveSelect,
      });
      if (!row) throw notFoundError("This leave request was not found.");
      if (count === 0) throw conflictError(ALREADY_DECIDED_MESSAGE);
      return toLeaveRequest(row, true);
    });
  },
};
