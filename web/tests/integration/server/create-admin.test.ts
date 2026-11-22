import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { buildSync } from "esbuild";
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

  function cli(
    args: string[],
    extraEnv: Record<string, string> = {},
    entry: string[] = [
      tsx,
      "--tsconfig",
      "scripts/tsconfig.cli.json",
      "scripts/create-admin.ts",
    ],
  ) {
    const env: NodeJS.ProcessEnv = { ...process.env, ...extraEnv };
    delete env.BETTER_AUTH_SECRET;
    delete env.BETTER_AUTH_URL;
    delete env.SKIP_ENV_VALIDATION;
    delete env.VITEST;
    return run(process.execPath, [...entry, ...args], {
      cwd: webDir,
      env,
    }).then(
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

  it("runs as the bundled create-admin.mjs shipped in the migrator image", async () => {
    const outfile = path.join(
      webDir,
      "node_modules",
      ".cache",
      "create-admin-test",
      "create-admin.mjs",
    );
    buildSync({
      entryPoints: [path.join(webDir, "scripts/create-admin.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      tsconfig: path.join(webDir, "scripts/tsconfig.cli.json"),
      outfile,
    });
    const r = await cli(
      ["--username", "bundled"],
      { CREATE_ADMIN_PASSWORD: PASSWORD },
      [outfile],
    );
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('created HR admin "bundled"');
    expect((await credentialOf("bundled")).user.role).toBe("HR_ADMIN");
  });
});
