import { describe, expect, it } from "vitest";
import { Role, type Session } from "@/contracts";
import { safeCallbackPath } from "./paths";
import {
  checkAccess,
  getSession,
  requireRole,
  requireSession,
  toRole,
} from "./session";

function session(overrides: Partial<Session["user"]> = {}): Session {
  return {
    user: {
      userId: "u1",
      employeeId: 1,
      username: "jane",
      displayName: "Jane Doe",
      role: Role.EMPLOYEE,
      mustChangePassword: false,
      ...overrides,
    },
    expires: new Date(0).toISOString(),
  };
}

describe("checkAccess", () => {
  it("unauthenticated without a session", () => {
    expect(checkAccess(null, null, undefined)).toBe("unauthenticated");
    expect(checkAccess(null, [Role.HR_ADMIN], undefined)).toBe(
      "unauthenticated",
    );
  });
  it("role matching", () => {
    expect(checkAccess(session(), null, undefined)).toBe("ok");
    expect(checkAccess(session(), [Role.EMPLOYEE], undefined)).toBe("ok");
    expect(checkAccess(session(), [Role.HR_ADMIN], undefined)).toBe(
      "forbidden",
    );
    expect(
      checkAccess(
        session({ role: Role.HR_ADMIN }),
        [Role.HR_ADMIN, Role.EMPLOYEE],
        undefined,
      ),
    ).toBe("ok");
  });
  it("forced password change blocks everything unless allowed, before the role check", () => {
    const s = session({ mustChangePassword: true, role: Role.HR_ADMIN });
    expect(checkAccess(s, null, undefined)).toBe("must-change-password");
    expect(checkAccess(s, [Role.HR_ADMIN], undefined)).toBe(
      "must-change-password",
    );
    expect(checkAccess(s, [Role.EMPLOYEE], undefined)).toBe(
      "must-change-password",
    );
    expect(checkAccess(s, null, { allowPendingPasswordChange: true })).toBe(
      "ok",
    );
    expect(
      checkAccess(s, [Role.EMPLOYEE], { allowPendingPasswordChange: true }),
    ).toBe("forbidden");
  });
});

describe("toRole", () => {
  it("maps the DB enum and fails safe", () => {
    expect(toRole("HR_ADMIN")).toBe(Role.HR_ADMIN);
    expect(toRole("EMPLOYEE")).toBe(Role.EMPLOYEE);
    expect(toRole("ADMIN")).toBe(Role.EMPLOYEE);
    expect(toRole(null)).toBe(Role.EMPLOYEE);
  });
});

describe("outside a request", () => {
  it("getSession returns null and requireX throws AuthError(UNAUTHENTICATED)", async () => {
    await expect(getSession()).resolves.toBeNull();
    await expect(requireSession()).rejects.toMatchObject({
      name: "AuthError",
      code: "UNAUTHENTICATED",
    });
    await expect(requireRole(Role.HR_ADMIN)).rejects.toMatchObject({
      name: "AuthError",
      code: "UNAUTHENTICATED",
    });
  });
});

describe("safeCallbackPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/employees/3?tab=leave", "/employees/3?tab=leave"],
    ["https://evil.example", null],
    ["//evil.example", null],
    ["/\\evil.example", null],
    ["/\tevil", null],
    ["javascript:alert(1)", null],
    ["/login", null],
    ["/login?callbackUrl=/x", null],
    ["", null],
    [null, null],
  ])("%s -> %s", (input, expected) => {
    expect(safeCallbackPath(input)).toBe(expected);
  });
});
