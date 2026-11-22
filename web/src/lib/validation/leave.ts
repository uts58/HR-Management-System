/**
 * Leave input schemas (contracts.md#leave). Fixes legacy BUG-12: dates are
 * required, must be real `YYYY-MM-DD` dates, and the range must not end
 * before it starts. Past dates are allowed (sick leave logged afterwards).
 */

import { z } from "zod";
import type { LeaveRequestId } from "@/contracts/common";
import {
  REQUESTABLE_LEAVE_TYPES,
  type ApplyForLeaveInput,
  type LeaveDecision,
} from "@/contracts/leave";
import {
  entityIdSchema,
  enumField,
  isoDateField,
  optionalText,
  whenFieldsValid,
} from "./common";

export const LEAVE_REASON_MAX = 1000;

export const LEAVE_DECISIONS = [
  "APPROVED",
  "REJECTED",
] as const satisfies readonly LeaveDecision[];

export const applyForLeaveSchema = z
  .object({
    // OTHER is not in REQUESTABLE_LEAVE_TYPES: only migrated rows use it.
    leaveType: enumField(REQUESTABLE_LEAVE_TYPES, "Select a leave type"),
    startDate: isoDateField("Start date"),
    endDate: isoDateField("End date"),
    reason: optionalText("Reason", LEAVE_REASON_MAX),
  })
  .refine((v) => v.endDate >= v.startDate, {
    error: "End date cannot be before the start date",
    path: ["endDate"],
    // Runs even when other fields fail, so all errors show at once.
    when: whenFieldsValid("startDate", "endDate"),
  }) satisfies z.ZodType<ApplyForLeaveInput>;

export const decideLeaveRequestSchema = z.object({
  id: entityIdSchema,
  decision: enumField(LEAVE_DECISIONS, "Choose approve or reject"),
}) satisfies z.ZodType<{ id: LeaveRequestId; decision: LeaveDecision }>;
