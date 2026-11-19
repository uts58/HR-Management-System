/**
 * STUB ACTIONS (Phase 1a). Plain async functions, NOT server actions: they
 * run in the browser and touch no data. Each one marks a submit seam that
 * gets replaced by a real action:
 *
 * - Backend: `web/src/server/actions/*.ts` ('use server', `defineAction`),
 *   imported from "@/server/actions" (director ruling). Stub names match the
 *   contracts.md action names.
 * - Security: `signOut` / `changePassword` from "@/auth/actions" and
 *   `signInWithUsername` from "@/auth/client".
 *
 * Mutations return a form-level "not connected" error so the error path
 * (alert + focus) can be reviewed. createEmployee and resetEmployeePassword
 * return fake one-time credentials so the credentials screen can be reviewed.
 * No validation is invented here: client checks come from Backend's Zod
 * schemas (ADR-0005).
 */

import type {
  ActionResult,
  CreateEmployeeResult,
  EmployeeDetail,
  IssuedCredentials,
} from "@/contracts";
import type { FormAction } from "@/components/forms/types";

import { employees } from "./fixtures";

const delay = () => new Promise((resolve) => setTimeout(resolve, 400));

function notConnected<T>(name: string): ActionResult<T> {
  return {
    ok: false,
    error: {
      code: "INTERNAL",
      message: `${name} is not connected yet. This form runs on stub data until the server action lands.`,
    },
  };
}

/** A form action that always answers "not connected". */
export function stubFormAction<T = void>(name: string): FormAction<T> {
  return async () => {
    await delay();
    return notConnected<T>(name);
  };
}

/** A button action (delete, decide, terminate) that answers "not connected". */
export async function stubCommand(name: string): Promise<ActionResult> {
  await delay();
  return notConnected(name);
}

const fakePassword = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789".charAt(b % 55),
  ).join("");

/** → createEmployee from @/server/actions */
export const createEmployeeStub: FormAction<CreateEmployeeResult> = async (
  _prev,
  formData,
) => {
  await delay();
  // TODO(Backend): replace with the real createEmployee action. The fake
  // result below only exists to show the one-time credentials screen.
  const first = String(formData.get("firstName") ?? "").trim() || "new";
  const last = String(formData.get("lastName") ?? "").trim() || "employee";
  const username =
    String(formData.get("username") ?? "").trim() ||
    `${first}.${last}`.toLowerCase().replace(/[^a-z0-9._]/g, "");
  const employee: EmployeeDetail = { ...employees[1]!, id: 99, username };
  return {
    ok: true,
    data: {
      employee,
      credentials: { username, temporaryPassword: fakePassword() },
    },
  };
};

/** → resetEmployeePassword from @/server/actions */
export async function resetEmployeePasswordStub(
  employeeId: number,
): Promise<ActionResult<IssuedCredentials>> {
  await delay();
  const e = employees.find((row) => row.id === employeeId);
  return {
    ok: true,
    data: {
      username: e?.username ?? "unknown",
      temporaryPassword: fakePassword(),
    },
  };
}
