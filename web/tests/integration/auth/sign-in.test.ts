import { beforeEach, describe, expect, it } from "vitest";
import { accountAdmin } from "@/auth";
import { isArgon2idHash, isBcryptHash, verifyPassword } from "@/auth/password";
import { loadSessionFromHeaders } from "@/auth/session";
import {
  cookieHeaders,
  createEmployee,
  createUser,
  credentialHash,
  freshIp,
  prisma,
  resetDb,
  signIn,
} from "./helpers";

beforeEach(resetDb);

const GENERIC = "Invalid username or password";

describe("sign-in (POST /api/auth/sign-in/username)", () => {
  it("signs in with the right password, case-insensitively, and creates a DB session", async () => {
    const employeeId = await createEmployee({
      firstName: "Jane",
      lastName: "Doe",
    });
    const userId = await createUser({
      username: "jane",
      password: "right-pass",
      employeeId,
    });

    const r = await signIn("JANE", "right-pass");
    expect(r.status).toBe(200);
    expect(r.cookie).toContain("session_token=");
    expect(await prisma.session.count({ where: { userId } })).toBe(1);

    const loaded = await loadSessionFromHeaders(cookieHeaders(r.cookie));
    expect(loaded?.session.user).toMatchObject({
      userId,
      employeeId,
      username: "jane",
      displayName: "Jane Doe",
      role: "EMPLOYEE",
      mustChangePassword: false,
    });
    // Internal fields never reach the browser.
    expect(r.body.user).not.toHaveProperty("disabledAt");
    expect(r.body.user).not.toHaveProperty("legacyPersonId");
  });

  it("rejects a wrong password and an unknown user with the same 401 and message", async () => {
    await createUser({ username: "jane", password: "right-pass" });
    const wrong = await signIn("jane", "wrong-pass");
    const unknown = await signIn("nobody", "wrong-pass");
    for (const r of [wrong, unknown]) {
      expect(r.status).toBe(401);
      expect(r.body.message).toBe(GENERIC);
      expect(r.cookie).toBe("");
    }
    expect(await prisma.session.count()).toBe(0);
  });

  it("blocks disabled users with the generic failure", async () => {
    await createUser({
      username: "gone",
      password: "right-pass",
      disabled: true,
    });
    const r = await signIn("gone", "right-pass");
    expect(r.status).toBe(401);
    expect(r.body.message).toBe(GENERIC);
    expect(await prisma.session.count()).toBe(0);
  });

  it("blocks users whose employee is TERMINATED with the generic failure", async () => {
    const employeeId = await createEmployee({ terminated: true });
    await createUser({ username: "left", password: "right-pass", employeeId });
    const r = await signIn("left", "right-pass");
    expect(r.status).toBe(401);
    expect(r.body.message).toBe(GENERIC);
  });

  it("rehashes a legacy bcrypt password to argon2id on successful sign-in only", async () => {
    const userId = await createUser({
      username: "legacy",
      password: "old-pass-1",
      format: "bcrypt",
    });
    const before = await credentialHash(userId);
    expect(isBcryptHash(before!)).toBe(true);

    expect((await signIn("legacy", "not-it")).status).toBe(401);
    expect(await credentialHash(userId)).toBe(before); // untouched after a failure

    expect((await signIn("legacy", "old-pass-1")).status).toBe(200);
    const after = await credentialHash(userId);
    expect(isArgon2idHash(after!)).toBe(true);
    expect(await verifyPassword({ hash: after!, password: "old-pass-1" })).toBe(
      true,
    );

    // And the new hash keeps working.
    expect((await signIn("legacy", "old-pass-1")).status).toBe(200);
  });

  it("does not offer self sign-up or email sign-in", async () => {
    const { handleAuthRequest } = await import("@/auth/route-handler");
    for (const path of ["/sign-up/email", "/sign-in/email"]) {
      const res = await handleAuthRequest(
        new Request(`http://localhost:3000/api/auth${path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            email: "x@example.com",
            password: "password-123",
            name: "x",
          }),
        }),
      );
      expect(res.status).toBe(404);
    }
    expect(await prisma.user.count()).toBe(0);
  });

  it("rate-limits /sign-in/username per client IP (10 per minute)", async () => {
    await createUser({ username: "jane", password: "right-pass" });
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++)
      statuses.push((await signIn("jane", "wrong", ip)).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
    // Even the right password is refused from that IP for now...
    expect((await signIn("jane", "right-pass", ip)).status).toBe(429);
    // ...but not from another client.
    expect((await signIn("jane", "right-pass", freshIp())).status).toBe(200);
  });

  it("sets the must-change hint cookie for flagged users and clears it otherwise", async () => {
    const flagged = await createUser({
      username: "temp",
      password: "temp-pass-1",
      mustChangePassword: true,
    });
    const r = await signIn("temp", "temp-pass-1");
    expect(r.status).toBe(200);
    expect(
      (r.body.user as { mustChangePassword?: boolean }).mustChangePassword,
    ).toBe(true);
    expect(
      r.setCookies.some((c) => c.startsWith("hr.must_change_password=1")),
    ).toBe(true);
    void flagged;

    await createUser({ username: "normal", password: "normal-pass" });
    const n = await signIn("normal", "normal-pass");
    expect(
      n.setCookies.some((c) =>
        /^hr\.must_change_password=;.*Max-Age=0/i.test(c),
      ),
    ).toBe(true);
  });

  it("disableLogin revokes existing sessions and blocks the next sign-in", async () => {
    const userId = await createUser({
      username: "jane",
      password: "right-pass",
    });
    const r = await signIn("jane", "right-pass");
    expect(
      await loadSessionFromHeaders(cookieHeaders(r.cookie)),
    ).not.toBeNull();

    await prisma.$transaction((tx) => accountAdmin.disableLogin(tx, userId));

    expect(await prisma.session.count({ where: { userId } })).toBe(0);
    expect(await loadSessionFromHeaders(cookieHeaders(r.cookie))).toBeNull();
    expect((await signIn("jane", "right-pass")).status).toBe(401);
  });

  it("getSession drops sessions of a user disabled behind its back", async () => {
    const userId = await createUser({
      username: "jane",
      password: "right-pass",
    });
    const r = await signIn("jane", "right-pass");
    await prisma.user.update({
      where: { id: userId },
      data: { disabledAt: new Date() },
    });
    expect(await loadSessionFromHeaders(cookieHeaders(r.cookie))).toBeNull();
    expect(await prisma.session.count({ where: { userId } })).toBe(0);
  });

  it("sign-out deletes the session", async () => {
    const { handleAuthRequest } = await import("@/auth/route-handler");
    const userId = await createUser({
      username: "jane",
      password: "right-pass",
    });
    const r = await signIn("jane", "right-pass");
    const res = await handleAuthRequest(
      new Request("http://localhost:3000/api/auth/sign-out", {
        method: "POST",
        headers: {
          cookie: r.cookie,
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(res.status).toBe(200);
    expect(await prisma.session.count({ where: { userId } })).toBe(0);
  });
});
