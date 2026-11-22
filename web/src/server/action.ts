import "server-only";

import { z } from "zod";
import { Role, type RequireOptions, type Session } from "@/contracts/auth";
import type { ActionResult, Actor } from "@/contracts/common";
import * as authSeam from "./auth-seam";
import type { AuthGate } from "./auth-seam";
import { runAction, type ErrorLogger } from "./errors";

export type SignedInRole = Role | readonly Role[] | "ANY";

export type ActionRole = SignedInRole | "PUBLIC";

export interface ActionContext {
  session: Session;
}

export interface ActionDefinition<S extends z.ZodType, O> {
  role: SignedInRole;
  schema: S;
  allowPendingPasswordChange?: boolean;
  handler: (
    actor: Actor,
    input: z.output<S>,
    context: ActionContext,
  ) => Promise<O> | O;
}

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

export interface ServerAction<I, O> {
  (input?: I | FormData): Promise<ActionResult<O>>;
  (
    prevState: ActionResult<O> | null | undefined,
    input: I | FormData,
  ): Promise<ActionResult<O>>;
}

export function toActor(session: Session): Actor {
  return {
    userId: session.user.userId,
    employeeId: session.user.employeeId,
    role: session.user.role,
  };
}

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
    throw new Error(`defineAction: invalid role ${JSON.stringify(role)}`);
  }
}

export interface DefineActionDeps {
  auth: AuthGate;
  log?: ErrorLogger;
}

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

export const defineAction = createDefineAction({
  auth: {
    requireRole: (...args) => authSeam.requireRole(...args),
    requireSession: (...args) => authSeam.requireSession(...args),
  },
});
