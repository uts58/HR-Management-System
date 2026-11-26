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
  toIsoInstant,
  toIsoInstantOrNull,
} from "@/lib/dates";
import {
  applyForLeaveSchema,
  decideLeaveRequestSchema,
} from "@/lib/validation/leave";
import { db } from "../db";
import { conflictError, forbiddenError, notFoundError } from "../errors";
import {
  assertRole,
  countOtherActiveHrAdmins,
  employeeRefSelect,
  lockHrAdminSet,
  newestFirst,
  oldestFirst,
  requireOwnEmployeeId,
  toEmployeeRef,
} from "../shared";

export const ALREADY_DECIDED_MESSAGE =
  "This leave request has already been decided.";

const NOT_FOUND_MESSAGE = "This leave request was not found.";

export const SELF_DECISION_MESSAGE =
  "You can't decide your own leave request. Another HR admin must decide it.";

const leaveSelect = {
  id: true,
  leaveType: true,
  startDate: true,
  endDate: true,
  reason: true,
  status: true,
  seenByEmployee: true,
  createdAt: true,
  decidedAt: true,
  selfApproved: true,
  employee: { select: employeeRefSelect },
} as const satisfies Prisma.LeaveRequestSelect;

type LeaveRow = Prisma.LeaveRequestGetPayload<{ select: typeof leaveSelect }>;

function toLeaveRequest(r: LeaveRow): LeaveRequest {
  return {
    id: r.id,
    employee: toEmployeeRef(r.employee),
    leaveType: r.leaveType,
    startDate: toIsoDateOrNull(r.startDate),
    endDate: toIsoDateOrNull(r.endDate),
    reason: r.reason,
    status: r.status,
    seenByEmployee: r.seenByEmployee,
    createdAt: toIsoInstant(r.createdAt),
    decidedAt: toIsoInstantOrNull(r.decidedAt),
    selfApproved: r.selfApproved,
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
    assertRole(actor, Role.EMPLOYEE, Role.HR_ADMIN);
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
    return toLeaveRequest(row);
  },

  async listMyLeaveRequests(actor) {
    assertRole(actor, Role.EMPLOYEE, Role.HR_ADMIN);
    const employeeId = requireOwnEmployeeId(actor);
    const rows = await db.leaveRequest.findMany({
      where: { employeeId },
      select: leaveSelect,
      orderBy: newestFirst(),
    });
    return rows.map((r) => toLeaveRequest(r));
  },

  async markMyLeaveDecisionsSeen(actor) {
    assertRole(actor, Role.EMPLOYEE, Role.HR_ADMIN);
    const employeeId = requireOwnEmployeeId(actor);
    const { count } = await db.leaveRequest.updateMany({
      where: unseenDecisions(employeeId),
      data: { seenByEmployee: true },
    });
    return count;
  },

  async countMyUnseenDecisions(actor) {
    assertRole(actor, Role.EMPLOYEE, Role.HR_ADMIN);
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
    return rows.map((r) => toLeaveRequest(r));
  },

  async listAllLeaveRequests(actor) {
    assertRole(actor, Role.HR_ADMIN);
    const rows = await db.leaveRequest.findMany({
      select: leaveSelect,
      orderBy: newestFirst(),
    });
    return rows.map((r) => toLeaveRequest(r));
  },

  async countPendingLeaveRequests(actor) {
    assertRole(actor, Role.HR_ADMIN);
    return db.leaveRequest.count({ where: { status: "PENDING" } });
  },

  async canDecideOwnLeave(actor) {
    assertRole(actor, Role.HR_ADMIN);
    return (await countOtherActiveHrAdmins(db, actor.userId)) === 0;
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
      const target = await tx.leaveRequest.findUnique({
        where: { id },
        select: { employeeId: true },
      });
      if (!target) throw notFoundError(NOT_FOUND_MESSAGE);
      const own =
        actor.employeeId != null && target.employeeId === actor.employeeId;
      if (own) {
        // Only the sole active HR admin may decide their own request.
        // The lock keeps the admin count stable until this transaction ends.
        await lockHrAdminSet(tx);
        if ((await countOtherActiveHrAdmins(tx, actor.userId)) > 0) {
          throw forbiddenError(SELF_DECISION_MESSAGE);
        }
      }
      const { count } = await tx.leaveRequest.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: decision,
          decidedAt: new Date(),
          decidedById: actor.userId,
          seenByEmployee: false,
          selfApproved: own,
        },
      });
      const row = await tx.leaveRequest.findUnique({
        where: { id },
        select: leaveSelect,
      });
      if (!row) throw notFoundError(NOT_FOUND_MESSAGE);
      if (count === 0) throw conflictError(ALREADY_DECIDED_MESSAGE);
      return toLeaveRequest(row);
    });
  },
};
