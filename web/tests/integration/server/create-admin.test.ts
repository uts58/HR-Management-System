import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { isArgon2idHash, verifyPassword } from "@/auth/password";
import { createHrAdmin } from "@/server/employee/create-admin";
import { signIn } from "../auth/helpers";
import {
  db,
  makeEmployee,
  makeUser,
  rejection,
  resetDatabase,
} from "./helpers";

beforeEach(resetDatabase);
afterAll(() => db.$disconnect());

const PASSWORD = "Bootstrap#2026";

async function credentialOf(username: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { username },
    include: { accounts: true, employee: true },
  });
  return { user, hash: user.accounts[0]?.password ?? "" };
}

describe("createHrAdmin", () => {
  it("creates an ACTIVE employee and an HR_ADMIN login with the given password", async () => {
    const r = await createHrAdmin({
      username: " Boss ",
      password: PASSWORD,
      firstName: "Grace",
      lastName: "Hopper",
      email: "Grace@Example.com",
    });
    expect(r).toEqual({
      created: true,
      username: "boss",
      employeeId: expect.any(Number),
    });

    const { user, hash } = await credentialOf("boss");
    expect(user).toMatchObject({
      role: "HR_ADMIN",
      name: "Grace Hopper",
      email: "grace@example.com",
      mustChangePassword: false,
      disabledAt: null,
      employeeId: r.employeeId,
      employee: {
        firstName: "Grace",
        lastName: "Hopper",
        employmentStatus: "ACTIVE",
      },
    });
    expect(isArgon2idHash(hash)).toBe(true);
    expect(await verifyPassword({ hash, password: PASSWORD })).toBe(true);
    expect((await signIn("boss", PASSWORD)).status).toBe(200);
  });

  it("is idempotent: a second run changes nothing, not even the password", async () => {
    await createHrAdmin({ username: "boss", password: PASSWORD });
    const before = await credentialOf("boss");

    const again = await createHrAdmin({
      username: "BOSS",
      password: "Another#Pass1",
    });
    expect(again).toEqual({
      created: false,
      username: "boss",
      employeeId: before.user.employeeId,
    });
    expect(await db.employee.count()).toBe(1);
    expect(await db.user.count()).toBe(1);
    expect((await credentialOf("boss")).hash).toBe(before.hash);
  });

  it("refuses a username held by a non-admin and never promotes it", async () => {
    const e = await makeEmployee();
    await makeUser(e.id, "EMPLOYEE", "boss");
    const err = await rejection(
      createHrAdmin({ username: "boss", password: PASSWORD }),
    );
    expect(err).toMatchObject({ code: "CONFLICT" });
    expect(
      (await db.user.findUniqueOrThrow({ where: { username: "boss" } })).role,
    ).toBe("EMPLOYEE");
    expect(await db.employee.count()).toBe(1);
  });

  it("rolls everything back when the password or username is invalid", async () => {
    for (const input of [
      { username: "boss", password: "short" },
      { username: "boss", password: "boss" },
      { username: "x", password: PASSWORD },
    ]) {
      const err = await rejection(createHrAdmin(input));
      expect(err).toMatchObject({ code: "VALIDATION" });
    }
    expect(await db.employee.count()).toBe(0);
    expect(await db.user.count()).toBe(0);
    expect(await db.account.count()).toBe(0);
  });
});

describe("npm run create-admin (CLI)", () => {
  const webDir = path.resolve(__dirname, "../../..");
  const run = promisify(execFile);
  const tsx = path.join(webDir, "node_modules", "tsx", "dist", "cli.mjs");

  function cli(args: string[], extraEnv: Record<string, string> = {}) {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ?? "x".repeat(32) + "-create-admin-test",
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000",
      ...extraEnv,
    };
    delete env.SKIP_ENV_VALIDATION;
    delete env.VITEST;
    return run(
      process.execPath,
      [
        tsx,
        "--tsconfig",
        "scripts/tsconfig.cli.json",
        "scripts/create-admin.ts",
        ...args,
      ],
      { cwd: webDir, env },
    ).then(
      (r) => ({ code: 0, ...r }),
      (e: { code: number; stdout: string; stderr: string }) => e,
    );
  }

  it("reads the password from the env, never prints it, and is idempotent", async () => {
    const env = { CREATE_ADMIN_PASSWORD: PASSWORD };
    const first = await cli(["--username", "boss"], env);
    expect(first.code).toBe(0);
    expect(first.stdout).toContain('created HR admin "boss"');

    const second = await cli(["--username", "boss"], env);
    expect(second.code).toBe(0);
    expect(second.stdout).toContain("already exists");

    for (const r of [first, second]) {
      expect(r.stdout + r.stderr).not.toContain(PASSWORD);
    }
    const { user, hash } = await credentialOf("boss");
    expect(user.role).toBe("HR_ADMIN");
    expect(await verifyPassword({ hash, password: PASSWORD })).toBe(true);
  });

  it("accepts --password and fails without printing a rejected one", async () => {
    const bad = await cli(["--username", "boss", "--password", "boss"]);
    expect(bad.code).toBe(1);
    expect(bad.stderr).toContain("create-admin:");
    expect(await db.user.count()).toBe(0);

    const missing = await cli([], { CREATE_ADMIN_PASSWORD: PASSWORD });
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain("--username");
    expect(missing.stdout + missing.stderr).not.toContain(PASSWORD);

    const ok = await cli(["--username", "ops", "--password", PASSWORD]);
    expect(ok.code).toBe(0);
    expect(ok.stdout + ok.stderr).not.toContain(PASSWORD);
  });
});
