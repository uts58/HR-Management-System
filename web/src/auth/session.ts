import "server-only";

import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { Role, type RequireOptions, type Session } from "@/contracts";
import { getAuth } from "./config";
import { prisma } from "./db";
import { AuthError } from "./errors";
import { CHANGE_PASSWORD_PATH, FORBIDDEN_PATH, LOGIN_PATH } from "./paths";

export interface LoadedSession {
  session: Session;
  sessionId: string;
  sessionToken: string;
}

export function toRole(value: string | null | undefined): Role {
  return value === Role.HR_ADMIN ? Role.HR_ADMIN : Role.EMPLOYEE;
}

function logError(msg: string, err: unknown): void {
  console.error(
    JSON.stringify({
      level: "error",
      msg,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
}

export async function loadSessionFromHeaders(
  requestHeaders: Headers,
): Promise<LoadedSession | null> {
  const result = await getAuth().api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });
  if (!result) return null;

  const user = await prisma.user.findUnique({
    where: { id: result.user.id },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      mustChangePassword: true,
      employeeId: true,
      disabledAt: true,
      employee: {
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          employmentStatus: true,
        },
      },
    },
  });
  if (!user) return null;

  if (
    user.disabledAt !== null ||
    user.employee?.employmentStatus === "TERMINATED"
  ) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    return null;
  }

  const fullName = user.employee
    ? [
        user.employee.firstName,
        user.employee.middleName,
        user.employee.lastName,
      ]
        .map((p) => p?.trim())
        .filter(Boolean)
        .join(" ")
    : "";

  return {
    sessionId: result.session.id,
    sessionToken: result.session.token,
    session: {
      user: {
        userId: user.id,
        employeeId: user.employeeId,
        username: user.username,
        displayName: fullName || user.name || user.username,
        role: toRole(user.role),
        mustChangePassword: user.mustChangePassword,
      },
      expires: new Date(result.session.expiresAt).toISOString(),
    },
  };
}

export const loadCurrentSession = cache(
  async (): Promise<LoadedSession | null> => {
    try {
      return await loadSessionFromHeaders(await headers());
    } catch (err) {
      // Next dynamic-render and redirect signals must propagate.
      unstable_rethrow(err);
      logError("auth: getSession failed", err);
      return null;
    }
  },
);

export async function getSession(): Promise<Session | null> {
  return (await loadCurrentSession())?.session ?? null;
}

async function currentPath(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-hr-pathname");
  } catch (err) {
    unstable_rethrow(err);
    return null;
  }
}

async function failUnauthenticated(
  opts: RequireOptions | undefined,
): Promise<never> {
  if (opts?.onFail === "redirect") {
    const path = await currentPath();
    redirect(
      path
        ? `${LOGIN_PATH}?callbackUrl=${encodeURIComponent(path)}`
        : LOGIN_PATH,
    );
  }
  throw new AuthError("UNAUTHENTICATED");
}

export function checkAccess(
  session: Session | null,
  roles: readonly Role[] | null,
  opts: RequireOptions | undefined,
): "ok" | "unauthenticated" | "must-change-password" | "forbidden" {
  if (!session) return "unauthenticated";
  if (session.user.mustChangePassword && !opts?.allowPendingPasswordChange) {
    return "must-change-password";
  }
  if (roles && !roles.includes(session.user.role)) return "forbidden";
  return "ok";
}

async function enforce(
  roles: readonly Role[] | null,
  opts: RequireOptions | undefined,
): Promise<Session> {
  const session = await getSession();
  const decision = checkAccess(session, roles, opts);
  const redirectMode = opts?.onFail === "redirect";
  switch (decision) {
    case "ok":
      return session as Session;
    case "unauthenticated":
      return failUnauthenticated(opts);
    case "must-change-password":
      if (redirectMode) redirect(CHANGE_PASSWORD_PATH);
      throw new AuthError("FORBIDDEN", "Change your password to continue.");
    case "forbidden":
      if (redirectMode) redirect(FORBIDDEN_PATH);
      throw new AuthError("FORBIDDEN");
  }
}

export function requireSession(opts?: RequireOptions): Promise<Session> {
  return enforce(null, opts);
}

export function requireRole(
  role: Role | readonly Role[],
  opts?: RequireOptions,
): Promise<Session> {
  const roles: readonly Role[] = typeof role === "string" ? [role] : role;
  return enforce(roles, opts);
}
