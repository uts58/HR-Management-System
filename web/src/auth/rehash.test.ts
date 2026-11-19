import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "./password";
import { rehashLegacyPassword, type RehashStore } from "./rehash";

/** In-memory stand-in for prisma.account with real compare-and-swap semantics. */
function fakeStore(initial: string | null) {
  const row = { id: "acc-1", userId: "user-1", password: initial };
  const store: RehashStore = {
    account: {
      findFirst: vi.fn(async ({ where }) =>
        where.userId === row.userId
          ? { id: row.id, password: row.password }
          : null,
      ),
      updateMany: vi.fn(async ({ where, data }) => {
        if (where.id === row.id && where.password === row.password) {
          row.password = data.password;
          return { count: 1 };
        }
        return { count: 0 };
      }),
    },
  };
  return { row, store };
}

describe("rehashLegacyPassword", () => {
  it("replaces a bcrypt hash with argon2id of the same password", async () => {
    const { row, store } = fakeStore(await bcrypt.hash("pw-legacy", 4));
    expect(await rehashLegacyPassword("user-1", "pw-legacy", store)).toBe(
      "rehashed",
    );
    expect(row.password!.startsWith("$argon2id$")).toBe(true);
    expect(
      await verifyPassword({ hash: row.password!, password: "pw-legacy" }),
    ).toBe(true);
    // The UPDATE was conditional on the exact old hash.
    const call = vi.mocked(store.account.updateMany).mock.calls[0]![0];
    expect(call.where.password.startsWith("$2")).toBe(true);
  });

  it("leaves argon2id hashes and missing credentials alone", async () => {
    const argon = await hashPassword("pw");
    const a = fakeStore(argon);
    expect(await rehashLegacyPassword("user-1", "pw", a.store)).toBe(
      "not-needed",
    );
    expect(a.row.password).toBe(argon);
    expect(a.store.account.updateMany).not.toHaveBeenCalled();

    const none = fakeStore(null);
    expect(await rehashLegacyPassword("user-1", "pw", none.store)).toBe(
      "not-needed",
    );
  });

  it("does not overwrite a password changed concurrently (compare-and-swap)", async () => {
    const { row, store } = fakeStore(await bcrypt.hash("pw-legacy", 4));
    const concurrent = await hashPassword("changed-by-hr");
    // Between the read and the write, someone else sets a new password.
    const realFind = store.account.findFirst;
    store.account.findFirst = vi.fn(async (args) => {
      const r = await realFind(args);
      row.password = concurrent;
      return r;
    });
    expect(await rehashLegacyPassword("user-1", "pw-legacy", store)).toBe(
      "lost-race",
    );
    expect(row.password).toBe(concurrent);
  });

  it("never throws: DB errors are logged and reported as failed", async () => {
    const { store } = fakeStore(await bcrypt.hash("pw", 4));
    store.account.updateMany = vi.fn(async () => {
      throw new Error("connection reset");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(rehashLegacyPassword("user-1", "pw", store)).resolves.toBe(
      "failed",
    );
    expect(log).toHaveBeenCalledOnce();
    expect(String(log.mock.calls[0]![0])).not.toContain("pw");
    log.mockRestore();
  });
});
