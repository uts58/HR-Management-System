"use server";

import { Role } from "@/contracts/auth";
import {
  createEmployeeSchema,
  resetEmployeePasswordSchema,
  terminateEmployeeSchema,
  updateEmployeeActionSchema,
} from "@/lib/validation/employee";
import { defineAction } from "@/server/action";
import { revalidateApp } from "../revalidate";
import { employeeService } from "./service";

/** Returns the new employee and the one-time credentials to show HR. */
export const createEmployee = defineAction({
  role: Role.HR_ADMIN,
  schema: createEmployeeSchema,
  handler: async (actor, input) => {
    const result = await employeeService.createEmployee(actor, input);
    revalidateApp();
    return result;
  },
});

/** Input `{ id, ...fields }` (ADR-0002 action input convention). */
export const updateEmployee = defineAction({
  role: Role.HR_ADMIN,
  schema: updateEmployeeActionSchema,
  handler: async (actor, { id, ...fields }) => {
    const employee = await employeeService.updateEmployee(actor, id, fields);
    revalidateApp();
    return employee;
  },
});

export const terminateEmployee = defineAction({
  role: Role.HR_ADMIN,
  schema: terminateEmployeeSchema,
  handler: async (actor, { id }) => {
    const employee = await employeeService.terminateEmployee(actor, id);
    revalidateApp();
    return employee;
  },
});

/** Returns the one-time credentials to show HR. */
export const resetEmployeePassword = defineAction({
  role: Role.HR_ADMIN,
  schema: resetEmployeePasswordSchema,
  handler: async (actor, { id }) =>
    employeeService.resetEmployeePassword(actor, id),
});
