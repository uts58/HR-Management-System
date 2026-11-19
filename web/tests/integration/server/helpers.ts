/**
 * Backend service integration-test helpers (real Postgres, ADR-0008).
 * Owner: Backend, inside QA's tests/integration/ (director ruling).
 *
 * Needs DATABASE_URL pointing at a throwaway, migrated database whose name
 * ends in `_test` or `_it`; anything else is refused, because every test
 * truncates all tables.
 */

import { randomUUID } from "node:crypto";
import type { AccountAdminApi } from "@/contracts/auth";
import type { Actor } from "@/contracts/common";
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db";
import { conflictError } from "@/server/errors";

const dbName = new URL(
  process.env.DATABASE_URL ?? "postgres://x/none",
).pathname.slice(1);
if (!/(_test|_it)$/.test(dbName)) {
  throw new Error(
    `Refusing to run service integration tests against database "${dbName}". ` +
      "Use a throwaway database whose name ends in _test or _it.",
  );
}

export { db };

export async function resetDatabase(): Promise<void> {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      leave_requests, appraisals, notices, sessions, accounts, verifications,
      users, employees, departments, positions
    RESTART IDENTITY CASCADE`);
}

export async function makeDepartment(name = "Engineering") {
  return db.department.create({ data: { name } });
}

export async function makePosition(name = "Developer") {
  return db.position.create({ data: { name } });
}

export async function makeEmployee(
  data: Partial<Prisma.EmployeeUncheckedCreateInput> = {},
) {
  return db.employee.create({
    data: { firstName: "Test", lastName: "Person", ...data },
  });
}

/** A users row linked to an employee, as Security's code would create it. */
export async function makeUser(
  employeeId: number | null,
  role: "HR_ADMIN" | "EMPLOYEE",
  username = `user${randomUUID().slice(0, 8)}`,
  extra: Partial<Prisma.UserUncheckedCreateInput> = {},
) {
  return db.user.create({
    data: {
      id: randomUUID(),
      name: username,
      email: `${username}@users.invalid`,
      emailIsPlaceholder: true,
      username,
      role,
      employeeId,
      ...extra,
    },
  });
}

/** Employee + user, returned with the matching Actor. */
export async function makePerson(
  role: "HR_ADMIN" | "EMPLOYEE",
  data: Partial<Prisma.EmployeeUncheckedCreateInput> = {},
) {
  const employee = await makeEmployee(data);
  const user = await makeUser(employee.id, role);
  const actor: Actor = { userId: user.id, employeeId: employee.id, role };
  return { employee, user, actor };
}

/** A migrated orphan placeholder (TERMINATED, no account). */
export async function makePlaceholder(id?: number) {
  return makeEmployee({
    ...(id ? { id } : {}),
    firstName: "Unknown",
    lastName: "Employee",
    isPlaceholder: true,
    employmentStatus: "TERMINATED",
    terminatedAt: new Date("2020-01-01T00:00:00Z"),
    createdAt: null,
  });
}

/**
 * In-test stand-in for Security's AccountAdminApi. Writes through the
 * caller's transaction client, like the real one must.
 */
export function fakeAccountAdmin() {
  const calls: string[] = [];
  const api: AccountAdminApi = {
    async createLoginAccount(rawTx, input) {
      const tx = rawTx as Tx;
      calls.push(`create:${input.username}`);
      const taken = await tx.user.findUnique({
        where: { username: input.username },
      });
      if (taken)
        throw conflictError("This username is already taken", "username");
      const emailTaken = input.email
        ? await tx.user.findUnique({ where: { email: input.email } })
        : null;
      const usePlaceholder = !input.email || !!emailTaken;
      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          name: input.displayName,
          email: usePlaceholder
            ? `${input.username}@users.invalid`
            : (input.email as string),
          emailIsPlaceholder: usePlaceholder,
          username: input.username,
          role: input.role,
          mustChangePassword: true,
          employeeId: input.employeeId,
        },
      });
      return {
        userId: user.id,
        credentials: {
          username: input.username,
          temporaryPassword: "Temp-Password-123",
        },
      };
    },
    async issueTemporaryPassword(rawTx, userId) {
      const tx = rawTx as Tx;
      calls.push(`reset:${userId}`);
      const user = await tx.user.update({
        where: { id: userId },
        data: { mustChangePassword: true },
      });
      return {
        username: user.username,
        temporaryPassword: "Temp-Password-456",
      };
    },
    async disableLogin(rawTx, userId) {
      const tx = rawTx as Tx;
      calls.push(`disable:${userId}`);
      await tx.user.update({
        where: { id: userId },
        data: { disabledAt: new Date() },
      });
      await tx.session.deleteMany({ where: { userId } });
    },
  };
  return { api, calls };
}

/** Await a promise expected to reject with a ServiceError-like error. */
export async function rejection(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e as {
      name: string;
      code: string;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };
  }
  throw new Error("Expected the promise to reject");
}
