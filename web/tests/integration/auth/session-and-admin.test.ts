import { beforeEach, describe, expect, it, vi } from "vitest";

// requireRole/requireSession read the request through next/headers. Point it
// at whatever cookie the test has signed in with.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({ delete: () => undefined, get: () => undefined }),
}));
// redirect() throws a control-flow error in Next; make it observable here.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT ${url}`), { redirectTo: url });
  },
}));

import { accountAdmin, requireRole, requireSession, Role } from "@/auth";
import { isArgon2idHash, verifyPassword } from "@/auth/password";
import { changePasswordForSession } from "@/auth/self-service";
import { loadSessionFromHeaders } from "@/auth/session";
import {
  cookieHeaders,
  createEmployee,
  createUser,
  credentialHash,
  prisma,
  resetDb,
  signIn,
} from "./helpers";

beforeEach(async () => {
  await resetDb();
  request.headers = new Headers();
});

async function signInAs(username: string, password: string): Promise<string> {
  const r = await signIn(username, password);
  expect(r.status).toBe(200);
  request.headers = cookieHeaders(r.cookie);
  return r.cookie;
}

describe("requireSession / requireRole", () => {
  it("anonymous: UNAUTHENTICATED (throw) or /login?callbackUrl (redirect)", async () => {
    await expect(requireSession()).rejects.toMatchObject({
      name: "AuthError",
      code: "UNAUTHENTICATED",
    });
    await expect(requireRole(Role.HR_ADMIN)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    request.headers = new Headers({ "x-hr-pathname": "/employees?page=2" });
    await expect(requireSession({ onFail: "redirect" })).rejects.toMatchObject({
      redirectTo: "/login?callbackUrl=%2Femployees%3Fpage%3D2",
    });
  });

  it("enforces the role from the database, not from the cookie", async () => {
    const hrEmployee = await createEmployee({
      firstName: "Hana",
      lastName: "Rahman",
    });
    const hrId = await createUser({
      username: "hradmin",
      password: "hr-pass-12",
      role: "HR_ADMIN",
      employeeId: hrEmployee,
    });
    await createUser({ username: "emp", password: "emp-pass-12" });

    await signInAs("emp", "emp-pass-12");
    await expect(requireRole(Role.HR_ADMIN)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      requireRole(Role.HR_ADMIN, { onFail: "redirect" }),
    ).rejects.toMatchObject({
      redirectTo: "/forbidden",
    });
    await expect(
      requireRole([Role.EMPLOYEE, Role.HR_ADMIN]),
    ).resolves.toMatchObject({
      user: { role: "EMPLOYEE" },
    });

    await signInAs("hradmin", "hr-pass-12");
    const s = await requireRole(Role.HR_ADMIN);
    expect(s.user).toMatchObject({
      userId: hrId,
      role: "HR_ADMIN",
      employeeId: hrEmployee,
      displayName: "Hana Rahman",
    });

    // Demote in the DB: the very next check sees it.
    await prisma.user.update({
      where: { id: hrId },
      data: { role: "EMPLOYEE" },
    });
    await expect(requireRole(Role.HR_ADMIN)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("terminated employee: session stops working", async () => {
    const employeeId = await createEmployee();
    await createUser({ username: "emp", password: "emp-pass-12", employeeId });
    await signInAs("emp", "emp-pass-12");
    await expect(requireSession()).resolves.toBeTruthy();
    await prisma.employee.update({
      where: { id: employeeId },
      data: { employmentStatus: "TERMINATED", terminatedAt: new Date() },
    });
    await expect(requireSession()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
});

describe("forced password change", () => {
  it("blocks everything except allowPendingPasswordChange until the password is changed", async () => {
    const userId = await createUser({
      username: "temp",
      password: "temp-pass-1",
      mustChangePassword: true,
    });
    await signInAs("temp", "temp-pass-1");

    await expect(requireSession()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireRole(Role.EMPLOYEE)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(requireSession({ onFail: "redirect" })).rejects.toMatchObject({
      redirectTo: "/change-password",
    });
    await expect(
      requireSession({ allowPendingPasswordChange: true }),
    ).resolves.toMatchObject({
      user: { mustChangePassword: true },
    });

    const current = await loadSessionFromHeaders(request.headers);
    await changePasswordForSession(current!, {
      currentPassword: "temp-pass-1",
      newPassword: "my-own-password",
      confirmPassword: "my-own-password",
    });

    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
        .mustChangePassword,
    ).toBe(false);
    await expect(requireRole(Role.EMPLOYEE)).resolves.toMatchObject({
      user: { mustChangePassword: false },
    });
  });
});

describe("server actions through defineAction", () => {
  it("a forced-change user: normal actions FORBIDDEN, changePassword and signOut allowed", async () => {
    const { changePassword, signOut } = await import("@/auth/actions");
    const { defineAction } = await import("@/server/action");
    const { z } = await import("zod");
    const ping = defineAction({
      role: Role.EMPLOYEE,
      schema: z.unknown(),
      handler: async () => "pong",
    });

    const userId = await createUser({
      username: "temp",
      password: "temp-pass-1",
      mustChangePassword: true,
    });
    await signInAs("temp", "temp-pass-1");

    expect(await ping({})).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(
      await changePassword({
        currentPassword: "temp-pass-1",
        newPassword: "short",
        confirmPassword: "short",
      }),
    ).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION",
        fieldErrors: { newPassword: expect.any(Array) },
      },
    });
    expect(
      await changePassword({
        currentPassword: "nope-nope",
        newPassword: "good-pass-99",
        confirmPassword: "good-pass-99",
      }),
    ).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION",
        fieldErrors: { currentPassword: expect.any(Array) },
      },
    });
    expect(
      await changePassword({
        currentPassword: "temp-pass-1",
        newPassword: "good-pass-99",
        confirmPassword: "good-pass-99",
      }),
    ).toEqual({ ok: true, data: undefined });
    expect(await ping({})).toEqual({ ok: true, data: "pong" });

    expect(await signOut()).toEqual({ ok: true, data: undefined });
    expect(await prisma.session.count({ where: { userId } })).toBe(0);
    expect(await ping({})).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });
});

describe("changePassword", () => {
  it("verifies the current password, writes argon2id, revokes only the OTHER sessions", async () => {
    const userId = await createUser({
      username: "jane",
      password: "old-pass-12",
      format: "bcrypt",
    });
    const other = (await signIn("jane", "old-pass-12")).cookie;
    // That sign-in already rehashed bcrypt -> argon2id; reset to bcrypt to
    // exercise changePassword against a legacy hash too.
    const bcryptjs = (await import("bcryptjs")).default;
    await prisma.account.updateMany({
      where: { userId },
      data: { password: await bcryptjs.hash("old-pass-12", 10) },
    });
    const mine = await signInAs("jane", "old-pass-12");
    expect(await prisma.session.count({ where: { userId } })).toBe(2);

    const current = await loadSessionFromHeaders(request.headers);

    await expect(
      changePasswordForSession(current!, {
        currentPassword: "wrong-one",
        newPassword: "new-pass-123",
        confirmPassword: "new-pass-123",
      }),
    ).rejects.toMatchObject({
      name: "ServiceError",
      code: "VALIDATION",
      fieldErrors: { currentPassword: expect.any(Array) },
    });

    await expect(
      changePasswordForSession(current!, {
        currentPassword: "old-pass-12",
        newPassword: "Jane",
        confirmPassword: "Jane",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { newPassword: expect.any(Array) },
    });

    await changePasswordForSession(current!, {
      currentPassword: "old-pass-12",
      newPassword: "new-pass-123",
      confirmPassword: "new-pass-123",
    });

    const hash = await credentialHash(userId);
    expect(isArgon2idHash(hash!)).toBe(true);
    expect(
      await verifyPassword({ hash: hash!, password: "new-pass-123" }),
    ).toBe(true);
    expect(await loadSessionFromHeaders(cookieHeaders(mine))).not.toBeNull();
    expect(await loadSessionFromHeaders(cookieHeaders(other))).toBeNull();
    expect(await prisma.session.count({ where: { userId } })).toBe(1);
    expect((await signIn("jane", "old-pass-12")).status).toBe(401);
    expect((await signIn("jane", "new-pass-123")).status).toBe(200);
  });
});

describe("AccountAdminApi", () => {
  it("createLoginAccount: temp password, forced change, real or placeholder email", async () => {
    const e1 = await createEmployee({ firstName: "Ann", lastName: "Lee" });
    const e2 = await createEmployee({ firstName: "Bob", lastName: "Kay" });
    const e3 = await createEmployee({ firstName: "Cy", lastName: "Oh" });

    const a = await prisma.$transaction((tx) =>
      accountAdmin.createLoginAccount(tx, {
        employeeId: e1,
        username: "Ann.Lee",
        displayName: "Ann Lee",
        email: "Ann@Example.com",
        role: Role.EMPLOYEE,
      }),
    );
    expect(a.credentials.username).toBe("ann.lee");
    expect(a.credentials.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    const ua = await prisma.user.findUniqueOrThrow({ where: { id: a.userId } });
    expect(ua).toMatchObject({
      email: "ann@example.com",
      emailIsPlaceholder: false,
      mustChangePassword: true,
      employeeId: e1,
      role: "EMPLOYEE",
    });
    expect(isArgon2idHash((await credentialHash(a.userId))!)).toBe(true);

    // Email already used -> placeholder. Missing -> placeholder.
    const b = await prisma.$transaction((tx) =>
      accountAdmin.createLoginAccount(tx, {
        employeeId: e2,
        username: "bob",
        displayName: "Bob Kay",
        email: "ann@example.com",
        role: Role.HR_ADMIN,
      }),
    );
    const c = await prisma.$transaction((tx) =>
      accountAdmin.createLoginAccount(tx, {
        employeeId: e3,
        username: "cy.oh",
        displayName: "Cy Oh",
        role: Role.EMPLOYEE,
      }),
    );
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: b.userId } }),
    ).toMatchObject({
      email: "bob@users.invalid",
      emailIsPlaceholder: true,
      role: "HR_ADMIN",
    });
    expect(
      await prisma.user.findUniqueOrThrow({ where: { id: c.userId } }),
    ).toMatchObject({
      email: "cy.oh@users.invalid",
      emailIsPlaceholder: true,
    });

    // The issued password works and lands on the forced change.
    const r = await signIn("ann.lee", a.credentials.temporaryPassword);
    expect(r.status).toBe(200);
    expect(
      (r.body.user as { mustChangePassword?: boolean }).mustChangePassword,
    ).toBe(true);
  });

  it("createLoginAccount: CONFLICT on a taken username, and it rolls back with the caller's transaction", async () => {
    const e1 = await createEmployee();
    const e2 = await createEmployee();
    await createUser({ username: "taken" });
    await expect(
      prisma.$transaction((tx) =>
        accountAdmin.createLoginAccount(tx, {
          employeeId: e1,
          username: "TAKEN",
          displayName: "X",
          role: Role.EMPLOYEE,
        }),
      ),
    ).rejects.toMatchObject({ name: "ServiceError", code: "CONFLICT" });

    await expect(
      prisma.$transaction(async (tx) => {
        await accountAdmin.createLoginAccount(tx, {
          employeeId: e2,
          username: "rolled.back",
          displayName: "Y",
          role: Role.EMPLOYEE,
        });
        throw new Error("caller failed later in the same transaction");
      }),
    ).rejects.toThrow("caller failed");
    expect(
      await prisma.user.count({ where: { username: "rolled.back" } }),
    ).toBe(0);
  });

  it("issueTemporaryPassword: new password, forced change, sessions revoked, creates a missing credential", async () => {
    const userId = await createUser({
      username: "jane",
      password: "jane-pass-1",
    });
    const old = (await signIn("jane", "jane-pass-1")).cookie;

    const creds = await prisma.$transaction((tx) =>
      accountAdmin.issueTemporaryPassword(tx, userId),
    );
    expect(creds.username).toBe("jane");
    expect(await loadSessionFromHeaders(cookieHeaders(old))).toBeNull();
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
        .mustChangePassword,
    ).toBe(true);
    expect((await signIn("jane", "jane-pass-1")).status).toBe(401);
    expect((await signIn("jane", creds.temporaryPassword)).status).toBe(200);

    const noCred = await createUser({ username: "migrated", format: "none" });
    expect((await signIn("migrated", "anything-at-all")).status).toBe(401);
    const c2 = await prisma.$transaction((tx) =>
      accountAdmin.issueTemporaryPassword(tx, noCred),
    );
    expect(
      await prisma.account.count({
        where: { userId: noCred, providerId: "credential" },
      }),
    ).toBe(1);
    expect((await signIn("migrated", c2.temporaryPassword)).status).toBe(200);
  });

  it("updateDisplayName: renames the user (not the username), joins the caller's tx, NOT_FOUND/VALIDATION", async () => {
    const userId = await createUser({
      username: "jane",
      password: "jane-pass-1",
    });

    await prisma.$transaction((tx) =>
      accountAdmin.updateDisplayName(tx, userId, "  Jane   Smith "),
    );
    expect(
      await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true, username: true },
      }),
    ).toEqual({ name: "Jane Smith", username: "jane" });
    // Login is unaffected.
    expect((await signIn("jane", "jane-pass-1")).status).toBe(200);

    // Rolls back with the caller's transaction.
    await expect(
      prisma.$transaction(async (tx) => {
        await accountAdmin.updateDisplayName(tx, userId, "Rolled Back");
        throw new Error("caller failed later");
      }),
    ).rejects.toThrow("caller failed later");
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).name,
    ).toBe("Jane Smith");

    await expect(
      prisma.$transaction((tx) =>
        accountAdmin.updateDisplayName(tx, "no-such-user", "X"),
      ),
    ).rejects.toMatchObject({ name: "ServiceError", code: "NOT_FOUND" });
    await expect(
      prisma.$transaction((tx) =>
        accountAdmin.updateDisplayName(tx, userId, "   "),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("issueTemporaryPassword / disableLogin: NOT_FOUND for an unknown user", async () => {
    await expect(
      prisma.$transaction((tx) =>
        accountAdmin.issueTemporaryPassword(tx, "no-such-user"),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      prisma.$transaction((tx) =>
        accountAdmin.disableLogin(tx, "no-such-user"),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
