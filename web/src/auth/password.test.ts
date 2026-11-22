import { describe, expect, it } from "vitest";
import {
  ARGON2_OPTIONS,
  checkPasswordPolicy,
  generateTemporaryPassword,
  hashPassword,
  isArgon2idHash,
  TEMPORARY_PASSWORD_LENGTH,
  verifyPassword,
} from "./password";

describe("hashPassword", () => {
  it("produces argon2id at (at least) the OWASP baseline", async () => {
    const h = await hashPassword("correct horse");
    expect(h.startsWith("$argon2id$v=19$")).toBe(true);
    const m = /\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(h);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(19_456);
    expect(Number(m![2])).toBeGreaterThanOrEqual(2);
    expect(Number(m![3])).toBe(1);
    expect(ARGON2_OPTIONS.memoryCost).toBe(19_456);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });
});

describe("verifyPassword", () => {
  it("accepts the right argon2id password and rejects a wrong one", async () => {
    const hash = await hashPassword("s3cret-pass");
    expect(await verifyPassword({ hash, password: "s3cret-pass" })).toBe(true);
    expect(await verifyPassword({ hash, password: "s3cret-pasS" })).toBe(false);
  });

  it("rejects bcrypt hashes (argon2id only)", async () => {
    // Known bcrypt vector (OpenBSD test suite) for the password "U*U".
    const hash = "$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW";
    expect(await verifyPassword({ hash, password: "U*U" })).toBe(false);
  });

  it("never matches plain text, unknown formats or garbage, and never throws", async () => {
    expect(isArgon2idHash(await hashPassword("x"))).toBe(true);
    for (const stored of [
      "legacy-pw",
      "",
      "$argon2id$garbage",
      "$2b$12$short",
      "$argon2i$v=19$m=1,t=1,p=1$x$y",
    ]) {
      expect(
        await verifyPassword({ hash: stored, password: "legacy-pw" }),
      ).toBe(false);
    }
  });
});

describe("generateTemporaryPassword", () => {
  it("is long enough, unambiguous, and random", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generateTemporaryPassword();
      expect(p).toHaveLength(TEMPORARY_PASSWORD_LENGTH);
      expect(p.length).toBeGreaterThanOrEqual(12);
      expect(p).toMatch(/^[a-km-zA-HJ-NP-Z2-9]+$/);
      seen.add(p);
    }
    expect(seen.size).toBe(200);
  });
});

describe("checkPasswordPolicy", () => {
  const base = { username: "john.doe" };
  it("accepts a good password", () => {
    expect(
      checkPasswordPolicy({
        ...base,
        newPassword: "long enough",
        confirmPassword: "long enough",
      }),
    ).toBeNull();
  });
  it("rejects short, too long, username and mismatch", () => {
    expect(
      checkPasswordPolicy({
        ...base,
        newPassword: "short",
        confirmPassword: "short",
      }),
    ).toHaveProperty("newPassword");
    const long = "x".repeat(129);
    expect(
      checkPasswordPolicy({
        ...base,
        newPassword: long,
        confirmPassword: long,
      }),
    ).toHaveProperty("newPassword");
    expect(
      checkPasswordPolicy({
        ...base,
        newPassword: "John.Doe",
        confirmPassword: "John.Doe",
      }),
    ).toHaveProperty("newPassword");
    expect(
      checkPasswordPolicy({
        ...base,
        newPassword: "long enough",
        confirmPassword: "long enougH",
      }),
    ).toHaveProperty("confirmPassword");
  });
});
