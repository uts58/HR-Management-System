import { describe, expect, it, vi } from "vitest";
import {
  accountAdmin,
  DISPLAY_NAME_MAX_LENGTH,
  normaliseDisplayName,
} from "./account-admin";

describe("normaliseDisplayName", () => {
  it("trims and collapses whitespace", () => {
    expect(normaliseDisplayName("  Jane \t  Doe\n")).toBe("Jane Doe");
  });

  it.each([
    { input: "", why: "required" },
    { input: "   ", why: "required" },
    { input: null, why: "required" },
    { input: "x".repeat(DISPLAY_NAME_MAX_LENGTH + 1), why: "too long" },
    { input: "Jane\u0000Doe", why: "invalid" },
  ])("rejects a $why name with VALIDATION on `name`", ({ input }) => {
    try {
      normaliseDisplayName(input);
      expect.unreachable();
    } catch (err) {
      expect(err).toMatchObject({
        name: "ServiceError",
        code: "VALIDATION",
        fieldErrors: { name: expect.any(Array) },
      });
    }
  });
});

describe("accountAdmin.updateDisplayName", () => {
  function fakeTx(count: number) {
    const updateMany = vi.fn(async () => ({ count }));
    return { tx: { user: { updateMany } }, updateMany };
  }

  it("writes the trimmed name through the given tx and nothing else", async () => {
    const { tx, updateMany } = fakeTx(1);
    await accountAdmin.updateDisplayName(tx, "user-1", "  Jane  Smith ");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Jane Smith" },
    });
  });

  it("NOT_FOUND when the user doesn't exist", async () => {
    const { tx } = fakeTx(0);
    await expect(
      accountAdmin.updateDisplayName(tx, "nope", "Jane"),
    ).rejects.toMatchObject({ name: "ServiceError", code: "NOT_FOUND" });
  });

  it("validates before touching the database", async () => {
    const { tx, updateMany } = fakeTx(1);
    await expect(
      accountAdmin.updateDisplayName(tx, "user-1", "   "),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
