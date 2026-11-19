"use server";

import { Role } from "@/contracts/auth";
import {
  createAppraisalSchema,
  deleteAppraisalSchema,
} from "@/lib/validation/performance";
import { defineAction } from "@/server/action";
import { revalidateApp } from "../revalidate";
import { performanceService } from "./service";

export const createAppraisal = defineAction({
  role: Role.HR_ADMIN,
  schema: createAppraisalSchema,
  handler: async (actor, input) => {
    const appraisal = await performanceService.createAppraisal(actor, input);
    revalidateApp();
    return appraisal;
  },
});

export const deleteAppraisal = defineAction({
  role: Role.HR_ADMIN,
  schema: deleteAppraisalSchema,
  handler: async (actor, { id }) => {
    await performanceService.deleteAppraisal(actor, id);
    revalidateApp();
  },
});
