/**
 * Fixtures for the auth integration tests. Self-contained: does not use the shared E2E fixtures. Needs DATABASE_URL pointing at
 * a throwaway, migrated database: every test truncates the tables it uses.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/auth/db";
import { hashPassword } from "@/auth/password";
import { handleAuthRequest } from "@/auth/route-handler";

export { prisma };

export const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "sessions", "accounts", "verifications", "users", "leave_requests", "appraisals", "employees" RESTART IDENTITY CASCADE',
  );
}

let ipCounter = 0;
/** A fresh client IP per call, so the per-IP rate limit never couples tests. */
export function freshIp(): string {
  ipCounter += 1;
  return `198.51.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

export async function createEmployee(
  overrides: {
    firstName?: string;
    lastName?: string;
    terminated?: boolean;
  } = {},
): Promise<number> {
  const e = await prisma.employee.create({
    data: {
      firstName: overrides.firstName ?? "Jane",
      lastName: overrides.lastName ?? "Doe",
      ...(overrides.terminated
        ? { employmentStatus: "TERMINATED", terminatedAt: new Date() }
        : {}),
    },
  });
  return e.id;
}

/** User with a known argon2id password, or no credential at all. */
export async function createUser(opts: {
  username: string;
  password?: string;
  format?: "argon2id" | "none";
  role?: "HR_ADMIN" | "EMPLOYEE";
  employeeId?: number | null;
  mustChangePassword?: boolean;
  disabled?: boolean;
}): Promise<string> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      name: opts.username,
      username: opts.username,
      email: `${opts.username}@users.invalid`,
      emailIsPlaceholder: true,
      role: opts.role ?? "EMPLOYEE",
      employeeId: opts.employeeId ?? null,
      mustChangePassword: opts.mustChangePassword ?? false,
      disabledAt: opts.disabled ? new Date() : null,
    },
  });
  const format = opts.format ?? "argon2id";
  if (format !== "none") {
    const pw = opts.password ?? "password-123";
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: await hashPassword(pw),
      },
    });
  }
  return id;
}

export interface SignInResult {
  status: number;
  body: Record<string, unknown>;
  /** "name=value" pairs from Set-Cookie, for the Cookie header. */
  cookie: string;
  setCookies: string[];
}

export async function signIn(
  username: string,
  password: string,
  ip: string = freshIp(),
): Promise<SignInResult> {
  const res = await handleAuthRequest(
    new Request(`${BASE_URL}/api/auth/sign-in/username`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ username, password }),
    }),
  );
  const setCookies = res.headers.getSetCookie();
  const cookie = setCookies
    .map((c) => c.split(";")[0]!)
    .filter((c) => !c.endsWith("="))
    .join("; ");
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // empty body (e.g. 429)
  }
  return { status: res.status, body, cookie, setCookies };
}

export function cookieHeaders(cookie: string): Headers {
  return new Headers({ cookie, origin: BASE_URL });
}

export async function credentialHash(userId: string): Promise<string | null> {
  const a = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { password: true },
  });
  return a?.password ?? null;
}
