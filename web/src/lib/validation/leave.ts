import { z } from "zod";
import type { LeaveRequestId } from "@/contracts/common";
import {
  LEAVE_TYPES,
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
    leaveType: enumField(LEAVE_TYPES, "Select a leave type"),
    startDate: isoDateField("Start date"),
    endDate: isoDateField("End date"),
    reason: optionalText("Reason", LEAVE_REASON_MAX),
  })
  .refine((v) => v.endDate >= v.startDate, {
    error: "End date cannot be before the start date",
    path: ["endDate"],
    when: whenFieldsValid("startDate", "endDate"),
  }) satisfies z.ZodType<ApplyForLeaveInput>;

export const decideLeaveRequestSchema = z.object({
  id: entityIdSchema,
  decision: enumField(LEAVE_DECISIONS, "Choose approve or reject"),
}) satisfies z.ZodType<{ id: LeaveRequestId; decision: LeaveDecision }>;
