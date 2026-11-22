import { randomUUID } from "node:crypto";
import type { AccountAdminApi } from "@/contracts/auth";
import type { Actor } from "@/contracts/common";
import type { Prisma } from "@/generated/prisma/client";
import { accountAdmin } from "@/server/account-admin-seam";
import { db } from "@/server/db";

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

export async function makeUser(
  employeeId: number | null,
  role: "HR_ADMIN" | "EMPLOYEE",
  username = `user${randomUUID().slice(0, 8)}`,
  extra: Partial<Prisma.UserUncheckedCreateInput> = {},
) {
  const id = randomUUID();
  return db.user.create({
    data: {
      id,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password: "unused",
        },
      },
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

export async function makePerson(
  role: "HR_ADMIN" | "EMPLOYEE",
  data: Partial<Prisma.EmployeeUncheckedCreateInput> = {},
) {
  const employee = await makeEmployee(data);
  const user = await makeUser(employee.id, role);
  const actor: Actor = { userId: user.id, employeeId: employee.id, role };
  return { employee, user, actor };
}

export function recordingAccountAdmin(failOn?: keyof AccountAdminApi): {
  api: AccountAdminApi;
  calls: string[];
} {
  const calls: string[] = [];
  const maybeFail = (method: keyof AccountAdminApi) => {
    if (failOn === method) throw new Error(`forced ${method} failure`);
  };
  const api: AccountAdminApi = {
    async createLoginAccount(tx, input) {
      calls.push(`create:${input.username}`);
      const result = await accountAdmin.createLoginAccount(tx, input);
      maybeFail("createLoginAccount");
      return result;
    },
    async issueTemporaryPassword(tx, userId) {
      calls.push(`reset:${userId}`);
      const result = await accountAdmin.issueTemporaryPassword(tx, userId);
      maybeFail("issueTemporaryPassword");
      return result;
    },
    async disableLogin(tx, userId) {
      calls.push(`disable:${userId}`);
      await accountAdmin.disableLogin(tx, userId);
      maybeFail("disableLogin");
    },
    async updateDisplayName(tx, userId, name) {
      calls.push(`rename:${userId}:${name}`);
      await accountAdmin.updateDisplayName(tx, userId, name);
      maybeFail("updateDisplayName");
    },
  };
  return { api, calls };
}

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
