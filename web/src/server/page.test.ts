import { describe, expect, it } from "vitest";
import { conflictError, notFoundError } from "./errors";
import { idOrNotFound, orNotFound } from "./page";

const NOT_FOUND_DIGEST = expect.stringContaining(
  "NEXT_HTTP_ERROR_FALLBACK;404",
);

describe("orNotFound", () => {
  it("returns the value", async () => {
    await expect(orNotFound(Promise.resolve(7))).resolves.toBe(7);
    await expect(orNotFound(async () => "x")).resolves.toBe("x");
  });

  it("turns ServiceError NOT_FOUND into Next's notFound()", async () => {
    await expect(
      orNotFound(Promise.reject(notFoundError("Employee not found."))),
    ).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
    await expect(
      orNotFound(async () => {
        throw notFoundError();
      }),
    ).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
  });

  it("rethrows every other error unchanged", async () => {
    const conflict = conflictError("nope");
    await expect(orNotFound(Promise.reject(conflict))).rejects.toBe(conflict);
    const boom = new Error("boom");
    await expect(orNotFound(Promise.reject(boom))).rejects.toBe(boom);
  });
});

describe("idOrNotFound", () => {
  it("parses a valid id", () => {
    expect(idOrNotFound("12")).toBe(12);
  });

  it.each(["abc", "0", "", undefined, "1.5"])("404s on %j", (raw) => {
    expect(() => idOrNotFound(raw)).toThrow(
      expect.objectContaining({ digest: NOT_FOUND_DIGEST }),
    );
  });
});
