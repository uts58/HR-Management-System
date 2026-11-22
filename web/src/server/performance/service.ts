/**
 * Performance appraisals (contracts.md#performance). HR only; employees
 * cannot see appraisals.
 *
 * A missing employee is a VALIDATION error on `employeeId` (schema),
 * and so is an unknown or terminated employee (service).
 */

import "server-only";

import { Role } from "@/contracts/auth";
import type { AppraisalId } from "@/contracts/common";
import {
  RATINGS,
  type Appraisal,
  type PerformanceService,
  type Rating,
} from "@/contracts/performance";
import type { Prisma } from "@/generated/prisma/client";
import {
  isoDateToUtcDate,
  toIsoDateOrNull,
  toIsoInstant,
} from "@/lib/dates";
import { entityIdSchema } from "@/lib/validation/common";
import { createAppraisalSchema } from "@/lib/validation/performance";
import { db } from "../db";
import { fieldValidationError, notFoundError } from "../errors";
import {
  assertRole,
  employeeRefSelect,
  newestFirst,
  toEmployeeRef,
} from "../shared";

export const INACTIVE_EMPLOYEE_MESSAGE = "Select an active employee";

const appraisalSelect = {
  id: true,
  projectName: true,
  projectStart: true,
  projectEnd: true,
  rating: true,
  createdAt: true,
  employee: { select: employeeRefSelect },
} as const satisfies Prisma.AppraisalSelect;

type AppraisalRow = Prisma.AppraisalGetPayload<{
  select: typeof appraisalSelect;
}>;

const toRating = (n: number | null): Rating | null =>
  n != null && (RATINGS as readonly number[]).includes(n)
    ? (n as Rating)
    : null;

function toAppraisal(r: AppraisalRow): Appraisal {
  return {
    id: r.id,
    employee: toEmployeeRef(r.employee),
    projectName: r.projectName,
    projectStart: toIsoDateOrNull(r.projectStart),
    projectEnd: toIsoDateOrNull(r.projectEnd),
    rating: toRating(r.rating),
    createdAt: toIsoInstant(r.createdAt),
  };
}

export const performanceService: PerformanceService = {
  async listAppraisals(actor) {
    assertRole(actor, Role.HR_ADMIN);
    const rows = await db.appraisal.findMany({
      select: appraisalSelect,
      orderBy: newestFirst(),
    });
    return rows.map(toAppraisal);
  },

  async createAppraisal(actor, raw) {
    assertRole(actor, Role.HR_ADMIN);
    const input = createAppraisalSchema.parse(raw);
    return db.$transaction(async (tx) => {
      // A termination racing this insert is harmless: appraisal history of
      // terminated employees is kept anyway (contract rule 4).
      const employee = await tx.employee.findFirst({
        where: {
          id: input.employeeId,
          employmentStatus: "ACTIVE",
        },
        select: { id: true },
      });
      if (!employee) {
        throw fieldValidationError("employeeId", INACTIVE_EMPLOYEE_MESSAGE);
      }
      const row = await tx.appraisal.create({
        data: {
          employeeId: input.employeeId,
          projectName: input.projectName,
          projectStart: isoDateToUtcDate(input.projectStart),
          projectEnd: isoDateToUtcDate(input.projectEnd),
          rating: input.rating,
        },
        select: appraisalSelect,
      });
      return toAppraisal(row);
    });
  },

  async deleteAppraisal(actor, rawId: AppraisalId) {
    assertRole(actor, Role.HR_ADMIN);
    const id = entityIdSchema.parse(rawId);
    const { count } = await db.appraisal.deleteMany({ where: { id } });
    if (count === 0) throw notFoundError("This appraisal was not found.");
  },
};
