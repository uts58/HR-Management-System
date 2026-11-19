/**
 * `defineAction`: the only way to write a server action (ADR-0002,
 * ADR-0003, ADR-0004, ADR-0006). The lint rule `hr/server-actions` requires
 * every export of a 'use server' file to be
 *
 *   export const createDepartment = defineAction({
 *     role: Role.HR_ADMIN,
 *     schema: createDepartmentSchema,
 *     handler: async (actor, input) => {
 *       const dept = await orgService.createDepartment(actor, input);
 *       revalidatePath("/departments");
 *       return dept;
 *     },
 *   });
 *
 * The returned function, in order:
 *  1. `requireRole(role)` (or `requireSession()` for role "ANY") in throw
 *     mode: failures become UNAUTHENTICATED / FORBIDDEN results;
 *  2. converts FormData to a plain object and validates it with `schema`
 *     (failures become VALIDATION with `fieldErrors`);
 *  3. calls `handler(actor, input, { session })`;
 *  4. returns `{ ok: true, data }`, or maps any thrown error with
 *     `toAppError` (ServiceError, Prisma P2002/P2025, else INTERNAL with a
 *     generic message). Next.js redirect()/notFound() errors are rethrown.
 *
 * It can be called directly with an object (`await createDepartment({ name
 * })`), as a form action (`<form action={createDepartment}>`, FormData), or
 * through `useActionState` (`(prevState, formData)`).
 */

import { z } from "zod";
import { Role, type RequireOptions, type Session } from "@/contracts/auth";
import type { ActionResult, Actor } from "@/contracts/common";
import * as authSeam from "./auth-seam";
import type { AuthGate } from "./auth-seam";
import { runAction, type ErrorLogger } from "./errors";

/** A role, a list of roles, or "ANY" signed-in user. */
export type SignedInRole = Role | readonly Role[] | "ANY";

/**
 * "PUBLIC" skips the session check entirely. Allowed only under
 * web/src/auth/ (Platform lint rule) and used only for the idempotent
 * signOut (ADR-0002).
 */
export type ActionRole = SignedInRole | "PUBLIC";

export interface ActionContext {
  /** The full session, for the rare handler that needs more than Actor. */
  session: Session;
}

export interface ActionDefinition<S extends z.ZodType, O> {
  role: SignedInRole;
  schema: S;
  /**
   * Let users with `mustChangePassword` through. Only Security's
   * changePassword sets this (ADR-0004 rule 8).
   */
  allowPendingPasswordChange?: boolean;
  handler: (
    actor: Actor,
    input: z.output<S>,
    context: ActionContext,
  ) => Promise<O> | O;
}

/** A "PUBLIC" action: no session check, so no actor or session. */
export interface PublicActionDefinition<S extends z.ZodType, O> {
  role: "PUBLIC";
  schema: S;
  allowPendingPasswordChange?: never;
  handler: (
    actor: null,
    input: z.output<S>,
    context: { session: null },
  ) => Promise<O> | O;
}

/**
 * What `defineAction` returns. The two-argument form (last, so
 * `useActionState` infers it) ignores the previous state.
 */
export interface ServerAction<I, O> {
  (input?: I | FormData): Promise<ActionResult<O>>;
  (
    prevState: ActionResult<O> | null | undefined,
    input: I | FormData,
  ): Promise<ActionResult<O>>;
}

/** Session -> the Actor every service takes first (ADR-0003). */
export function toActor(session: Session): Actor {
  return {
    userId: session.user.userId,
    employeeId: session.user.employeeId,
    role: session.user.role,
  };
}

/**
 * FormData -> plain object. Repeated keys become arrays. Next.js internal
 * fields (`$ACTION_…`) are dropped.
 */
export function formDataToObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = form.getAll(key);
    out[key] = values.length === 1 ? values[0] : values;
  }
  return out;
}

function rawInput(args: readonly unknown[]): unknown {
  const payload = args.length >= 2 ? args[1] : args[0];
  return payload instanceof FormData ? formDataToObject(payload) : payload;
}

const ROLE_VALUES = new Set<string>(Object.values(Role));

function assertValidRole(role: ActionRole): void {
  if (role === "ANY" || role === "PUBLIC") return;
  const roles: readonly unknown[] = Array.isArray(role) ? role : [role];
  if (roles.length === 0 || !roles.every((r) => ROLE_VALUES.has(r as string))) {
    // A misconfigured action fails when its module loads, not at request time.
    throw new Error(`defineAction: invalid role ${JSON.stringify(role)}`);
  }
}

export interface DefineActionDeps {
  auth: AuthGate;
  log?: ErrorLogger;
}

/**
 * Build a `defineAction` bound to an auth implementation. Production code
 * uses the exported `defineAction`; tests pass a fake `auth`.
 */
export function createDefineAction({ auth, log }: DefineActionDeps) {
  function defineAction<S extends z.ZodType, O>(
    definition: ActionDefinition<S, O>,
  ): ServerAction<z.input<S>, O>;
  function defineAction<S extends z.ZodType, O>(
    definition: PublicActionDefinition<S, O>,
  ): ServerAction<z.input<S>, O>;
  function defineAction<S extends z.ZodType, O>(
    definition: ActionDefinition<S, O> | PublicActionDefinition<S, O>,
  ): ServerAction<z.input<S>, O> {
    assertValidRole(definition.role);
    const options: RequireOptions = {
      onFail: "throw",
      ...(definition.allowPendingPasswordChange
        ? { allowPendingPasswordChange: true }
        : {}),
    };

    async function action(...args: unknown[]): Promise<ActionResult<O>> {
      return runAction(async () => {
        if (definition.role === "PUBLIC") {
          const input = await definition.schema.parseAsync(rawInput(args));
          return definition.handler(null, input, { session: null });
        }
        const { role } = definition;
        const session =
          role === "ANY"
            ? await auth.requireSession(options)
            : await auth.requireRole(role, options);
        const input = await definition.schema.parseAsync(rawInput(args));
        return definition.handler(toActor(session), input, { session });
      }, log);
    }

    return action as ServerAction<z.input<S>, O>;
  }
  return defineAction;
}

/** See the module comment. Bound to `@/auth` through `./auth-seam`. */
export const defineAction = createDefineAction({
  auth: {
    requireRole: (...args) => authSeam.requireRole(...args),
    requireSession: (...args) => authSeam.requireSession(...args),
  },
});
