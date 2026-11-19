"use server";

import { Role } from "@/contracts/auth";
import { noInputSchema } from "@/lib/validation/common";
import {
  applyForLeaveSchema,
  decideLeaveRequestSchema,
} from "@/lib/validation/leave";
import { defineAction } from "@/server/action";
import { revalidateApp } from "../revalidate";
import { leaveService } from "./service";

export const applyForLeave = defineAction({
  role: Role.EMPLOYEE,
  schema: applyForLeaveSchema,
  handler: async (actor, input) => {
    const request = await leaveService.applyForLeave(actor, input);
    revalidateApp();
    return request;
  },
});

/** Input `{ id, decision }`; decision is APPROVED or REJECTED. */
export const decideLeaveRequest = defineAction({
  role: Role.HR_ADMIN,
  schema: decideLeaveRequestSchema,
  handler: async (actor, { id, decision }) => {
    const request = await leaveService.decideLeaveRequest(actor, id, decision);
    revalidateApp();
    return request;
  },
});

/**
 * Called by the leave-history page once it has rendered (contract rule 5),
 * so reads stay free of side effects. Returns how many rows changed.
 */
export const markMyLeaveDecisionsSeen = defineAction({
  role: Role.EMPLOYEE,
  schema: noInputSchema,
  handler: async (actor) => {
    const changed = await leaveService.markMyLeaveDecisionsSeen(actor);
    if (changed > 0) revalidateApp();
    return changed;
  },
});
