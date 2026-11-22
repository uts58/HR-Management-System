/**
 * Helpers shared by the domain services: role checks (ADR-0003 second
 * gate), employee references, and history ordering.
 */

import "server-only";

import type { Role } from "@/contracts/auth";
import type { Actor, EmployeeId } from "@/contracts/common";
import type { EmployeeRef } from "@/contracts/employee";
import type { Prisma } from "@/generated/prisma/client";
import { forbiddenError } from "./errors";

/** Throw FORBIDDEN unless the actor has one of `roles`. */
export function assertRole(actor: Actor, ...roles: Role[]): void {
  if (!roles.includes(actor.role)) throw forbiddenError();
}

/** The actor's own employee id, or FORBIDDEN for accounts without one. */
export function requireOwnEmployeeId(actor: Actor): EmployeeId {
  if (actor.employeeId == null) {
    throw forbiddenError("Your account is not linked to an employee record.");
  }
  return actor.employeeId;
}

/** "First Middle Last", middle omitted when empty. */
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

export const employeeRefSelect = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  employmentStatus: true,
} as const satisfies Prisma.EmployeeSelect;

export type EmployeeRefRow = Prisma.EmployeeGetPayload<{
  select: typeof employeeRefSelect;
}>;

/** How leave and appraisal history refers to an employee. */
export function toEmployeeRef(e: EmployeeRefRow): EmployeeRef {
  return {
    id: e.id,
    name: fullName(e),
    status: e.employmentStatus,
  };
}

/** History ordering by creation; `id` breaks ties. */
type CreationOrder = Array<
  { createdAt: Prisma.SortOrder } | { id: Prisma.SortOrder }
>;

export function newestFirst(): CreationOrder {
  return [{ createdAt: "desc" }, { id: "desc" }];
}

export function oldestFirst(): CreationOrder {
  return [{ createdAt: "asc" }, { id: "asc" }];
}
