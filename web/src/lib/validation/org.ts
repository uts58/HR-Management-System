/**
 * Department and position input schemas (contracts.md#org).
 * Name uniqueness (case-insensitive) is checked in the service and by the
 * `lower(name)` unique index; see `@/server/errors` for the mapping.
 */

import { z } from "zod";
import type {
  CreateDepartmentInput,
  CreatePositionInput,
} from "@/contracts/org";
import { idInputSchema, requiredText } from "./common";

export const ORG_NAME_MAX = 100;

export const createDepartmentSchema = z.object({
  name: requiredText("Name", ORG_NAME_MAX),
}) satisfies z.ZodType<CreateDepartmentInput>;

export const createPositionSchema = z.object({
  name: requiredText("Name", ORG_NAME_MAX),
}) satisfies z.ZodType<CreatePositionInput>;

export const deleteDepartmentSchema = idInputSchema;
export const deletePositionSchema = idInputSchema;
