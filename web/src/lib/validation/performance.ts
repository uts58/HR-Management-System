/**
 * Appraisal input schemas (contracts.md#performance). Fixes legacy BUG-11:
 * the employee is required and reported on field `employeeId` instead of
 * failing silently. The service also checks the employee exists, is ACTIVE
 * and is not a placeholder (VALIDATION on `employeeId`).
 */

import { z } from "zod";
import {
  RATINGS,
  type CreateAppraisalInput,
  type Rating,
} from "@/contracts/performance";
import { idField, idInputSchema, isoDateField, requiredText } from "./common";

export const PROJECT_NAME_MAX = 200;

const RATING_MESSAGE = "Rating must be between 1 and 5";

/** 1..5, from a select (string) or a number. */
export const ratingField = z.preprocess(
  (v) =>
    typeof v === "string" && /^\s*\d+\s*$/.test(v) ? Number(v.trim()) : v,
  z
    .number({ error: RATING_MESSAGE })
    .refine((n) => (RATINGS as readonly number[]).includes(n), {
      error: RATING_MESSAGE,
    })
    .transform((n) => n as Rating),
);

export const createAppraisalSchema = z
  .object({
    employeeId: idField("Select an employee"),
    projectName: requiredText("Project name", PROJECT_NAME_MAX),
    projectStart: isoDateField("Start date"),
    projectEnd: isoDateField("End date"),
    rating: ratingField,
  })
  .refine((v) => v.projectEnd >= v.projectStart, {
    error: "End date cannot be before the start date",
    path: ["projectEnd"],
  }) satisfies z.ZodType<CreateAppraisalInput>;

export const deleteAppraisalSchema = idInputSchema;
