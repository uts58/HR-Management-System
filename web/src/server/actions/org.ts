"use server";

import { Role } from "@/contracts/auth";
import {
  createDepartmentSchema,
  createPositionSchema,
  deleteDepartmentSchema,
  deletePositionSchema,
} from "@/lib/validation/org";
import { defineAction } from "@/server/action";
import { revalidateApp } from "@/server/revalidate";
import { orgService } from "@/server/org/service";

export const createDepartment = defineAction({
  role: Role.HR_ADMIN,
  schema: createDepartmentSchema,
  handler: async (actor, input) => {
    const department = await orgService.createDepartment(actor, input);
    revalidateApp();
    return department;
  },
});

export const deleteDepartment = defineAction({
  role: Role.HR_ADMIN,
  schema: deleteDepartmentSchema,
  handler: async (actor, { id }) => {
    await orgService.deleteDepartment(actor, id);
    revalidateApp();
  },
});

export const createPosition = defineAction({
  role: Role.HR_ADMIN,
  schema: createPositionSchema,
  handler: async (actor, input) => {
    const position = await orgService.createPosition(actor, input);
    revalidateApp();
    return position;
  },
});

export const deletePosition = defineAction({
  role: Role.HR_ADMIN,
  schema: deletePositionSchema,
  handler: async (actor, { id }) => {
    await orgService.deletePosition(actor, id);
    revalidateApp();
  },
});
