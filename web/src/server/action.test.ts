import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Role, type RequireOptions, type Session } from "@/contracts/auth";
import { createDepartmentSchema } from "@/lib/validation/org";
import { applyForLeaveSchema } from "@/lib/validation/leave";
import { noInputSchema } from "@/lib/validation/common";
import type { AuthGate } from "./auth-seam";
import {
  createDefineAction,
  defineAction as productionDefineAction,
  formDataToObject,
  toActor,
} from "./action";
import { conflictError } from "./errors";

const hrSession: Session = {
  user: {
    userId: "user-hr",
    employeeId: 1,
    username: "admin",
    displayName: "Admin User",
    role: Role.HR_ADMIN,
    mustChangePassword: false,
  },
  expires: "2026-11-24T00:00:00.000Z",
};

const employeeSession: Session = {
  user: {
    ...hrSession.user,
    userId: "user-emp",
    employeeId: 2,
    role: "EMPLOYEE",
  },
  expires: hrSession.expires,
};

class FakeAuthError extends Error {
  override name = "AuthError";
  constructor(readonly code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
  }
}

function fakeAuth(session: Session | null) {
  const check = (roles: readonly string[] | null, opts?: RequireOptions) => {
    if (!session) throw new FakeAuthError("UNAUTHENTICATED");
    if (session.user.mustChangePassword && !opts?.allowPendingPasswordChange) {
      throw new FakeAuthError("FORBIDDEN");
    }
    if (roles && !roles.includes(session.user.role)) {
      throw new FakeAuthError("FORBIDDEN");
    }
    return session;
  };
  const auth = {
    requireRole: vi.fn(
      async (role: Role | readonly Role[], opts?: RequireOptions) =>
        check(Array.isArray(role) ? role : [role as Role], opts),
    ),
    requireSession: vi.fn(async (opts?: RequireOptions) => check(null, opts)),
  } satisfies AuthGate;
  return auth;
}

const silentLog = vi.fn();

function setup(session: Session | null) {
  const auth = fakeAuth(session);
  const defineAction = createDefineAction({ auth, log: silentLog });
  const handler = vi.fn(async (actor: unknown, input: { name: string }) => ({
    id: 10,
    name: input.name,
  }));
  const action = defineAction({
    role: Role.HR_ADMIN,
    schema: createDepartmentSchema,
    handler,
  });
  return { auth, handler, action, defineAction };
}

describe("defineAction pipeline", () => {
  it("runs requireRole -> schema -> handler and returns ok", async () => {
    const { auth, handler, action } = setup(hrSession);
    const order: string[] = [];
    auth.requireRole.mockImplementationOnce(async () => {
      order.push("auth");
      return hrSession;
    });
    handler.mockImplementationOnce(async (_actor, input) => {
      order.push("handler");
      return { id: 10, name: input.name };
    });

    const result = await action({ name: "  Finance  " });

    expect(result).toEqual({ ok: true, data: { id: 10, name: "Finance" } });
    expect(order).toEqual(["auth", "handler"]);
    expect(auth.requireRole).toHaveBeenCalledWith(Role.HR_ADMIN, {
      onFail: "throw",
    });
    expect(handler).toHaveBeenCalledWith(
      { userId: "user-hr", employeeId: 1, role: "HR_ADMIN" },
      { name: "Finance" },
      { session: hrSession },
    );
  });

  it("signed out -> UNAUTHENTICATED; nothing else runs", async () => {
    const { handler, action } = setup(null);
    const parse = vi.spyOn(createDepartmentSchema, "parseAsync");
    const result = await action({ name: "Finance" });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Your session has ended. Please sign in again.",
      },
    });
    expect(parse).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it("wrong role -> FORBIDDEN before validation", async () => {
    const { handler, action } = setup(employeeSession);
    const result = await action({ name: "" });
    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("invalid input -> VALIDATION with fieldErrors; handler not called", async () => {
    const { handler, action } = setup(hrSession);
    const result = await action({ name: "   " });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Please correct the highlighted fields.",
        fieldErrors: { name: ["Name is required"] },
      },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("cross-field rule errors land on the right field (BUG-12)", async () => {
    const auth = fakeAuth(employeeSession);
    const action = createDefineAction({ auth })({
      role: Role.EMPLOYEE,
      schema: applyForLeaveSchema,
      handler: async () => "created",
    });
    const result = await action({
      leaveType: "SICK",
      startDate: "2026-11-21",
      endDate: "2026-11-20",
    });
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION",
        fieldErrors: { endDate: ["End date cannot be before the start date"] },
      },
    });
  });

  it("ServiceError from the handler -> its code, message and field", async () => {
    const { handler, action } = setup(hrSession);
    handler.mockRejectedValueOnce(
      conflictError("A department with this name already exists", "name"),
    );
    expect(await action({ name: "Finance" })).toEqual({
      ok: false,
      error: {
        code: "CONFLICT",
        message: "A department with this name already exists",
        fieldErrors: { name: ["A department with this name already exists"] },
      },
    });
  });

  it("unexpected error -> INTERNAL with no internals leaked", async () => {
    const { handler, action } = setup(hrSession);
    handler.mockRejectedValueOnce(
      new Error("password=hunter2 at db.ts:12 (SQL: SELECT ...)"),
    );
    const result = await action({ name: "Finance" });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Something went wrong. Please try again.",
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/hunter2|SQL|db\.ts/);
  });

  it("rethrows redirect() from the handler", async () => {
    const { handler, action } = setup(hrSession);
    handler.mockImplementationOnce(async () => redirect("/departments"));
    await expect(action({ name: "Finance" })).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });
});

describe("defineAction input forms", () => {
  it("accepts FormData (form action)", async () => {
    const { handler, action } = setup(hrSession);
    const form = new FormData();
    form.set("name", " Ops ");
    form.set("$ACTION_ID_abc123", "");
    expect(await action(form)).toEqual({
      ok: true,
      data: { id: 10, name: "Ops" },
    });
    expect(handler.mock.calls[0]?.[1]).toEqual({ name: "Ops" });
  });

  it("accepts (prevState, FormData) from useActionState", async () => {
    const { action } = setup(hrSession);
    const form = new FormData();
    form.set("name", "Sales");
    const prev = {
      ok: false as const,
      error: { code: "VALIDATION" as const, message: "x" },
    };
    expect(await action(prev, form)).toEqual({
      ok: true,
      data: { id: 10, name: "Sales" },
    });
  });

  it("formDataToObject keeps repeated keys as arrays", () => {
    const form = new FormData();
    form.append("tag", "a");
    form.append("tag", "b");
    form.append("one", "1");
    form.append("$ACTION_REF_1", "");
    expect(formDataToObject(form)).toEqual({ tag: ["a", "b"], one: "1" });
  });
});

describe("defineAction roles and options", () => {
  it("role list is passed through", async () => {
    const auth = fakeAuth(employeeSession);
    const action = createDefineAction({ auth })({
      role: [Role.HR_ADMIN, Role.EMPLOYEE],
      schema: noInputSchema,
      handler: async (actor) => actor.employeeId,
    });
    expect(await action()).toEqual({ ok: true, data: 2 });
    expect(auth.requireRole).toHaveBeenCalledWith(
      [Role.HR_ADMIN, Role.EMPLOYEE],
      { onFail: "throw" },
    );
  });

  it('role "ANY" uses requireSession', async () => {
    const auth = fakeAuth(employeeSession);
    const action = createDefineAction({ auth })({
      role: "ANY",
      schema: noInputSchema,
      handler: async () => "ok",
    });
    expect(await action()).toEqual({ ok: true, data: "ok" });
    expect(auth.requireSession).toHaveBeenCalledWith({ onFail: "throw" });
    expect(auth.requireRole).not.toHaveBeenCalled();
  });

  it("mustChangePassword users are blocked unless allowPendingPasswordChange", async () => {
    const pending: Session = {
      ...employeeSession,
      user: { ...employeeSession.user, mustChangePassword: true },
    };
    const auth = fakeAuth(pending);
    const define = createDefineAction({ auth });
    const blocked = define({
      role: "ANY",
      schema: noInputSchema,
      handler: async () => "ran",
    });
    const allowed = define({
      role: "ANY",
      schema: noInputSchema,
      allowPendingPasswordChange: true,
      handler: async () => "ran",
    });
    expect(await blocked()).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(await allowed()).toEqual({ ok: true, data: "ran" });
    expect(auth.requireSession).toHaveBeenLastCalledWith({
      onFail: "throw",
      allowPendingPasswordChange: true,
    });
  });

  it.each([[[]], ["ADMIN"], [["HR_ADMIN", "nope"]]])(
    "rejects invalid role %j at definition time",
    (role) => {
      const define = createDefineAction({ auth: fakeAuth(hrSession) });
      expect(() =>
        define({
          role: role as never,
          schema: z.unknown(),
          handler: async () => null,
        }),
      ).toThrow(/invalid role/);
    },
  );

  it("toActor copies only userId, employeeId and role", () => {
    expect(toActor(hrSession)).toEqual({
      userId: "user-hr",
      employeeId: 1,
      role: "HR_ADMIN",
    });
  });
});

describe("production defineAction (wired to @/auth)", () => {
  it("returns UNAUTHENTICATED outside a signed-in request", async () => {
    const handler = vi.fn(async () => "should not run");
    const action = productionDefineAction({
      role: Role.HR_ADMIN,
      schema: createDepartmentSchema,
      handler,
    });
    expect(await action({ name: "Finance" })).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('role "PUBLIC"', () => {
  it("runs without any session check, with no actor or session", async () => {
    const auth = fakeAuth(null);
    const action = createDefineAction({ auth })({
      role: "PUBLIC",
      schema: noInputSchema,
      handler: async (actor, _input, ctx) => ({ actor, session: ctx.session }),
    });
    expect(await action()).toEqual({
      ok: true,
      data: { actor: null, session: null },
    });
    expect(auth.requireRole).not.toHaveBeenCalled();
    expect(auth.requireSession).not.toHaveBeenCalled();
  });

  it("still validates input and maps errors", async () => {
    const define = createDefineAction({ auth: fakeAuth(null), log: silentLog });
    const action = define({
      role: "PUBLIC",
      schema: createDepartmentSchema,
      handler: async () => {
        throw new Error("internal detail");
      },
    });
    expect(await action({ name: "" })).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION",
        fieldErrors: { name: ["Name is required"] },
      },
    });
    expect(await action({ name: "x" })).toEqual({
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Something went wrong. Please try again.",
      },
    });
  });

  it("works with the production defineAction without any session", async () => {
    const action = productionDefineAction({
      role: "PUBLIC",
      schema: noInputSchema,
      handler: async () => "signed out",
    });
    expect(await action()).toEqual({ ok: true, data: "signed out" });
  });
});
