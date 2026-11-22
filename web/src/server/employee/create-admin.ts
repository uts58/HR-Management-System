import "server-only";

import { Role, type AccountAdminApi } from "@/contracts/auth";
import type { EmployeeId } from "@/contracts/common";
import {
  accountAdmin as defaultAccountAdmin,
  setInitialPassword as defaultSetInitialPassword,
} from "../account-admin-seam";
import { db } from "../db";
import { conflictError } from "../errors";
import { fullName } from "../shared";

export interface CreateHrAdminInput {
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
}

export interface CreateHrAdminResult {
  created: boolean;
  username: string;
  employeeId: EmployeeId | null;
}

export async function createHrAdmin(
  input: CreateHrAdminInput,
  deps: {
    accounts?: AccountAdminApi;
    setInitialPassword?: typeof defaultSetInitialPassword;
  } = {},
): Promise<CreateHrAdminResult> {
  const accounts = deps.accounts ?? defaultAccountAdmin;
  const setPassword = deps.setInitialPassword ?? defaultSetInitialPassword;
  const username = input.username.trim().toLowerCase();
  const firstName = input.firstName?.trim() || "HR";
  const lastName = input.lastName?.trim() || "Admin";
  const email = input.email?.trim().toLowerCase() || null;

  return db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { username },
      select: { role: true, employeeId: true },
    });
    if (existing) {
      if (existing.role !== Role.HR_ADMIN) {
        throw conflictError(
          `"${username}" already exists and is not an HR admin.`,
          "username",
        );
      }
      return { created: false, username, employeeId: existing.employeeId };
    }

    const employee = await tx.employee.create({
      data: { firstName, lastName, email, employmentStatus: "ACTIVE" },
      select: { id: true },
    });
    const { userId } = await accounts.createLoginAccount(tx, {
      employeeId: employee.id,
      username,
      displayName: fullName({ firstName, lastName }),
      email,
      role: Role.HR_ADMIN,
    });
    await setPassword(tx, userId, input.password);
    return { created: true, username, employeeId: employee.id };
  });
}
