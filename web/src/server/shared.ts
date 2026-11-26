import "server-only";

import { Role } from "@/contracts/auth";
import type { Actor, EmployeeId, UserId } from "@/contracts/common";
import type { EmployeeRef } from "@/contracts/employee";
import type { Prisma } from "@/generated/prisma/client";
import { forbiddenError } from "./errors-core";

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

export function toEmployeeRef(e: EmployeeRefRow): EmployeeRef {
  return {
    id: e.id,
    name: fullName(e),
    status: e.employmentStatus,
  };
}

type CreationOrder = Array<
  { createdAt: Prisma.SortOrder } | { id: Prisma.SortOrder }
>;

export function newestFirst(): CreationOrder {
  return [{ createdAt: "desc" }, { id: "desc" }];
}

export function oldestFirst(): CreationOrder {
  return [{ createdAt: "asc" }, { id: "asc" }];
}

// Serialises every change to the set of active HR admins (termination,
// create-admin) with every check that depends on it (self-decided leave).
const HR_ADMIN_SET_LOCK_KEY = 72_001;

export async function lockHrAdminSet(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$executeRaw`SELECT 1 FROM pg_advisory_xact_lock(${HR_ADMIN_SET_LOCK_KEY}::bigint)`;
}

// Enabled HR_ADMIN logins other than `userId` whose employee record (if any)
// is not terminated. Call after lockHrAdminSet in the same transaction.
export function countOtherActiveHrAdmins(
  tx: Prisma.TransactionClient,
  userId: UserId,
): Promise<number> {
  return tx.user.count({
    where: {
      id: { not: userId },
      role: Role.HR_ADMIN,
      disabledAt: null,
      OR: [{ employeeId: null }, { employee: { employmentStatus: "ACTIVE" } }],
    },
  });
}
