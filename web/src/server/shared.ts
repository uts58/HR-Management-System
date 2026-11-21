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

/** Placeholder employees never appear in lists, pickers or counts. */
export const NOT_PLACEHOLDER = { isPlaceholder: false } as const;

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

/** "First Last". */
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
  isPlaceholder: true,
} as const satisfies Prisma.EmployeeSelect;

export type EmployeeRefRow = Prisma.EmployeeGetPayload<{
  select: typeof employeeRefSelect;
}>;

/** History reference; placeholders show "Unknown employee #<id>". */
export function toEmployeeRef(e: EmployeeRefRow): EmployeeRef {
  return {
    id: e.id,
    name: e.isPlaceholder ? `Unknown employee #${e.id}` : shortName(e),
    status: e.employmentStatus,
    isPlaceholder: e.isPlaceholder,
  };
}

/**
 * History ordering by creation. Migrated rows have no createdAt, so they
 * count as the oldest: last when newest-first, first when oldest-first.
 * `id` breaks ties (migrated ids keep legacy order).
 */
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
