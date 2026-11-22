import "server-only";

import type { Role } from "@/contracts/auth";
import type { Actor, EmployeeId } from "@/contracts/common";
import type { EmployeeRef } from "@/contracts/employee";
import type { Prisma } from "@/generated/prisma/client";
import { forbiddenError } from "./errors";

export function assertRole(actor: Actor, ...roles: Role[]): void {
  if (!roles.includes(actor.role)) throw forbiddenError();
}

export function requireOwnEmployeeId(actor: Actor): EmployeeId {
  if (actor.employeeId == null) {
    throw forbiddenError("Your account is not linked to an employee record.");
  }
  return actor.employeeId;
}

export function fullName(e: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}): string {
  return [e.firstName, e.middleName, e.lastName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

export function shortName(e: { firstName: string; lastName: string }): string {
  return [e.firstName, e.lastName]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ");
}

export const employeeRefSelect = {
  id: true,
  firstName: true,
  lastName: true,
  employmentStatus: true,
} as const satisfies Prisma.EmployeeSelect;

export type EmployeeRefRow = Prisma.EmployeeGetPayload<{
  select: typeof employeeRefSelect;
}>;

export function toEmployeeRef(e: EmployeeRefRow): EmployeeRef {
  return {
    id: e.id,
    name: shortName(e),
    status: e.employmentStatus,
  };
}

type CreationOrder = Array<
  | { createdAt: { sort: Prisma.SortOrder; nulls: Prisma.NullsOrder } }
  | { id: Prisma.SortOrder }
>;

export function newestFirst(): CreationOrder {
  return [{ createdAt: { sort: "desc", nulls: "last" } }, { id: "desc" }];
}

export function oldestFirst(): CreationOrder {
  return [{ createdAt: { sort: "asc", nulls: "first" } }, { id: "asc" }];
}
