import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { notFound, redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  INTERNAL_ERROR_MESSAGE,
  ServiceError,
  conflictError,
  fieldValidationError,
  forbiddenError,
  getUniqueViolation,
  isAuthError,
  isForeignKeyViolation,
  isServiceError,
  notFoundError,
  runAction,
  toActionResult,
  toAppError,
  uniqueViolationToConflict,
  validationError,
} from "./errors";

/** A P2002 shaped exactly like Prisma 7 + @prisma/adapter-pg produces it. */
function adapterUniqueViolation(
  constraint: { index: string } | { fields: string[] },
  table = "departments",
) {
  return new PrismaClientKnownRequestError(
    "Unique constraint failed on the (not available)",
    {
      code: "P2002",
      clientVersion: "7.10.1",
      meta: {
        driverAdapterError: {
          name: "DriverAdapterError",
          cause: {
            originalCode: "23505",
            originalMessage: `duplicate key value violates unique constraint "${
              "index" in constraint ? constraint.index : "x"
            }"`,
            kind: "UniqueConstraintViolation",
            constraint,
            table,
          },
        },
        table,
      },
    },
  );
}

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new PrismaClientKnownRequestError(`Prisma ${code}`, {
    code,
    clientVersion: "7.10.1",
    meta,
  });
}

class FakeAuthError extends Error {
  override name = "AuthError";
  constructor(readonly code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(`auth: ${code}`);
  }
}

const silent = () => {};

describe("ServiceError and helpers", () => {
  it("has the contract shape", () => {
    const e = new ServiceError("CONFLICT", "Already decided");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ServiceError");
    expect(e.code).toBe("CONFLICT");
    expect(e.message).toBe("Already decided");
    expect(e.fieldErrors).toBeUndefined();
    expect(isServiceError(e)).toBe(true);
  });

  it("uses a default message per code", () => {
    expect(notFoundError().message).toBe("The requested record was not found.");
    expect(forbiddenError().code).toBe("FORBIDDEN");
  });

  it("conflictError attaches the message to a field", () => {
    expect(conflictError("Taken", "username").fieldErrors).toEqual({
      username: ["Taken"],
    });
    expect(conflictError("In use").fieldErrors).toBeUndefined();
  });

  it("validation helpers set fieldErrors", () => {
    expect(validationError({ a: ["x"] })).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { a: ["x"] },
    });
    expect(
      fieldValidationError("employeeId", "Select an active employee"),
    ).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { employeeId: ["Select an active employee"] },
    });
  });

  it("isServiceError accepts a structurally identical error from another module copy", () => {
    const foreign = Object.assign(new Error("x"), {
      name: "ServiceError",
      code: "NOT_FOUND",
    });
    expect(isServiceError(foreign)).toBe(true);
    expect(
      isServiceError(Object.assign(new Error("x"), { name: "ServiceError" })),
    ).toBe(false);
  });

  it("isAuthError checks name and code", () => {
    expect(isAuthError(new FakeAuthError("FORBIDDEN"))).toBe(true);
    expect(
      isAuthError(Object.assign(new Error(), { name: "AuthError", code: "X" })),
    ).toBe(false);
    expect(isAuthError({ name: "AuthError", code: "FORBIDDEN" })).toBe(false);
  });
});

describe("unique violations (P2002)", () => {
  it("reads the constraint name from the pg driver adapter error", () => {
    expect(
      getUniqueViolation(
        adapterUniqueViolation({ index: "departments_name_lower_key" }),
      ),
    ).toEqual({ constraint: "departments_name_lower_key" });
  });

  it("reads fields when the driver reports columns", () => {
    expect(
      getUniqueViolation(adapterUniqueViolation({ fields: ['"username"'] })),
    ).toMatchObject({ fields: ["username"] });
  });

  it("falls back to the constraint name in the original message", () => {
    const e = prismaError("P2002", {
      driverAdapterError: {
        cause: {
          originalMessage:
            'duplicate key value violates unique constraint "positions_name_lower_key"',
        },
      },
    });
    expect(getUniqueViolation(e)).toEqual({
      constraint: "positions_name_lower_key",
    });
  });

  it("supports the engine-style meta.target", () => {
    expect(
      getUniqueViolation(prismaError("P2002", { target: ["username"] })),
    ).toEqual({ fields: ["username"] });
    expect(
      getUniqueViolation(
        prismaError("P2002", { target: "departments_name_lower_key" }),
      ),
    ).toEqual({ constraint: "departments_name_lower_key" });
  });

  it("returns null for anything that is not a P2002", () => {
    expect(getUniqueViolation(prismaError("P2025"))).toBeNull();
    expect(getUniqueViolation(new Error("x"))).toBeNull();
    expect(getUniqueViolation(null)).toBeNull();
  });

  it.each([
    [
      "departments_name_lower_key",
      "name",
      "A department with this name already exists",
    ],
    [
      "positions_name_lower_key",
      "name",
      "A position with this name already exists",
    ],
    ["users_username_key", "username", "This username is already taken"],
  ])("maps %s to CONFLICT on %s", (index, field, message) => {
    const conflict = uniqueViolationToConflict(
      adapterUniqueViolation({ index }),
    );
    expect(conflict).toBeInstanceOf(ServiceError);
    expect(conflict).toMatchObject({
      code: "CONFLICT",
      message,
      fieldErrors: { [field]: [message] },
    });
  });

  it("can be restricted to the constraints a service expects", () => {
    const e = adapterUniqueViolation({ index: "positions_name_lower_key" });
    expect(
      uniqueViolationToConflict(e, ["departments_name_lower_key"]),
    ).toBeNull();
    expect(
      uniqueViolationToConflict(e, ["positions_name_lower_key"])?.code,
    ).toBe("CONFLICT");
  });

  it("returns null for an unknown constraint", () => {
    expect(
      uniqueViolationToConflict(
        adapterUniqueViolation({ index: "something_else_key" }),
      ),
    ).toBeNull();
  });
});

describe("toAppError (ADR-0006 mapping)", () => {
  it("ZodError -> VALIDATION with flattened fieldErrors", () => {
    const r = z
      .object({ name: z.string().min(1, "Name is required") })
      .safeParse({ name: "" });
    expect(r.success).toBe(false);
    expect(toAppError(r.error)).toEqual({
      code: "VALIDATION",
      message: "Please correct the highlighted fields.",
      fieldErrors: { name: ["Name is required"] },
    });
  });

  it("ZodError with a root-level issue uses it as the message", () => {
    const r = z.object({ a: z.string() }).safeParse("not an object");
    expect(toAppError(r.error).code).toBe("VALIDATION");
    expect(toAppError(r.error).message).not.toBe("");
  });

  it("ServiceError keeps code, message and fieldErrors", () => {
    expect(toAppError(conflictError("Taken", "username"))).toEqual({
      code: "CONFLICT",
      message: "Taken",
      fieldErrors: { username: ["Taken"] },
    });
    expect(toAppError(notFoundError("Employee not found"))).toEqual({
      code: "NOT_FOUND",
      message: "Employee not found",
    });
  });

  it("AuthError -> UNAUTHENTICATED / FORBIDDEN without its message", () => {
    expect(toAppError(new FakeAuthError("UNAUTHENTICATED"))).toEqual({
      code: "UNAUTHENTICATED",
      message: "Your session has ended. Please sign in again.",
    });
    expect(toAppError(new FakeAuthError("FORBIDDEN"))).toEqual({
      code: "FORBIDDEN",
      message: "You do not have permission to do that.",
    });
  });

  it("known P2002 -> CONFLICT on the field", () => {
    expect(
      toAppError(
        adapterUniqueViolation({ index: "departments_name_lower_key" }),
      ),
    ).toEqual({
      code: "CONFLICT",
      message: "A department with this name already exists",
      fieldErrors: { name: ["A department with this name already exists"] },
    });
  });

  it("unknown P2002 -> generic CONFLICT", () => {
    expect(
      toAppError(adapterUniqueViolation({ index: "users_email_key" })),
    ).toEqual({
      code: "CONFLICT",
      message: "A record with these details already exists.",
    });
  });

  it("P2025 -> NOT_FOUND", () => {
    expect(toAppError(prismaError("P2025")).code).toBe("NOT_FOUND");
  });

  it("anything else -> INTERNAL with a generic message, logged with a request id", () => {
    const log = vi.fn();
    const secret = new Error(
      'relation "employees" does not exist at /srv/x.ts',
    );
    const appError = toAppError(secret, log);

    expect(appError).toEqual({
      code: "INTERNAL",
      message: INTERNAL_ERROR_MESSAGE,
    });
    expect(JSON.stringify(appError)).not.toContain("employees");
    expect(log).toHaveBeenCalledOnce();
    const entry = log.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(entry.level).toBe("error");
    expect(entry.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.error).toMatchObject({
      name: "Error",
      message: secret.message,
    });
  });

  it("P2003 is detectable but stays INTERNAL globally (ADR-0006)", () => {
    expect(isForeignKeyViolation(prismaError("P2003"))).toBe(true);
    expect(isForeignKeyViolation(prismaError("P2002"))).toBe(false);
    expect(isForeignKeyViolation(new Error("x"))).toBe(false);
  });

  it("other Prisma errors and non-Error throws -> INTERNAL", () => {
    expect(toAppError(prismaError("P2003"), silent).code).toBe("INTERNAL");
    expect(toAppError("a string", silent).code).toBe("INTERNAL");
    expect(toAppError(undefined, silent).code).toBe("INTERNAL");
  });

  it("toActionResult wraps it", () => {
    expect(toActionResult(notFoundError())).toEqual({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "The requested record was not found.",
      },
    });
  });

  it("the default logger writes one JSON line to stderr", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      toAppError(new Error("boom"));
      expect(spy).toHaveBeenCalledOnce();
      expect(() => JSON.parse(String(spy.mock.calls[0]?.[0]))).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("runAction", () => {
  it("returns ok with the value", async () => {
    await expect(runAction(async () => 42)).resolves.toEqual({
      ok: true,
      data: 42,
    });
  });

  it("maps thrown errors", async () => {
    await expect(
      runAction(async () => {
        throw notFoundError("Notice not found");
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Notice not found" },
    });
  });

  it("rethrows Next.js redirect()", async () => {
    const result = runAction(async () => redirect("/dashboard"));
    await expect(result).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("rethrows Next.js notFound()", async () => {
    const result = runAction(async () => notFound());
    await expect(result).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404"),
    });
  });

  it("rethrows a Next.js error wrapped as a cause", async () => {
    const result = runAction(async () => {
      try {
        redirect("/x");
      } catch (e) {
        throw new Error("wrapped", { cause: e });
      }
    });
    await expect(result).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});
