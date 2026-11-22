import "server-only";

import { randomUUID } from "node:crypto";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getIP } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { username, USERNAME_ERROR_CODES } from "better-auth/plugins/username";
import { env } from "@/env";
import { prisma } from "./db";
import { MUST_CHANGE_COOKIE } from "./paths";
import {
  hashPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  verifyPassword,
} from "./password";
import {
  LoginFailureLimiter,
  loginFailureLimiter,
  UsernameBackoffLimiter,
  usernameBackoffLimiter,
} from "./login-limiter";

function limiterKey(
  ctx: { headers?: Headers; context: { options: BetterAuthOptions } },
  attemptedUsername: string,
): string {
  const ip = ctx.headers ? getIP(ctx.headers, ctx.context.options) : null;
  return LoginFailureLimiter.key(ip, attemptedUsername);
}

export const ALLOWED_AUTH_PATHS = [
  "/sign-in/username",
  "/sign-out",
  "/get-session",
  "/ok",
  "/error",
] as const;

const DISABLED_PATHS = [
  "/sign-in/email",
  "/sign-in/social",
  "/sign-up/email",
  "/update-user",
  "/update-session",
  "/change-password",
  "/change-email",
  "/delete-user",
  "/delete-user/callback",
  "/request-password-reset",
  "/reset-password",
  "/verify-email",
  "/send-verification-email",
  "/verify-password",
  "/is-username-available",
  "/link-social",
  "/unlink-account",
  "/list-accounts",
  "/account-info",
  "/get-access-token",
  "/refresh-token",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
];

function invalidCredentials(): APIError {
  return APIError.from(
    "UNAUTHORIZED",
    USERNAME_ERROR_CODES.INVALID_USERNAME_OR_PASSWORD,
  );
}

const secureCookies = env.BETTER_AUTH_URL?.startsWith("https://") ?? false;

function setMustChangeHint(
  ctx: {
    setCookie: (
      name: string,
      value: string,
      options: Record<string, unknown>,
    ) => unknown;
  },
  on: boolean,
): void {
  ctx.setCookie(MUST_CHANGE_COOKIE, on ? "1" : "", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: on ? 60 * 60 * 24 * 7 : 0,
  });
}

function createAuth() {
  return betterAuth({
    appName: "HR Management System",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : [],
    telemetry: { enabled: false },

    database: prismaAdapter(prisma, { provider: "postgresql" }),

    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },

    user: {
      // Every field must stay input: false, or users could set their own role or employeeId.
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "EMPLOYEE",
          input: false,
        },
        mustChangePassword: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
        employeeId: { type: "number", required: false, input: false },
        disabledAt: {
          type: "date",
          required: false,
          input: false,
          returned: false,
        },
        emailIsPlaceholder: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },

    rateLimit: {
      enabled: true,
      storage: "memory",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/username": { window: 60, max: 50 },
      },
    },

    disabledPaths: DISABLED_PATHS,

    advanced: {
      useSecureCookies: secureCookies,
      ipAddress: {
        // Caddy overwrites X-Forwarded-For with the TCP peer, so it is the one header we trust.
        ipAddressHeaders: ["x-forwarded-for"],
      },
      database: {
        generateId: () => randomUUID(),
      },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/username") return;
        const body = (ctx.body ?? {}) as {
          username?: unknown;
          password?: unknown;
        };
        if (typeof body.username !== "string") return;

        if (ctx.request) {
          const key = limiterKey(ctx, body.username);
          const retryAfter = Math.max(
            loginFailureLimiter.retryAfterSeconds(key),
            usernameBackoffLimiter.retryAfterSeconds(
              UsernameBackoffLimiter.key(body.username),
            ),
          );
          if (retryAfter > 0) {
            throw new APIError(
              "TOO_MANY_REQUESTS",
              { message: "Too many requests. Please try again later." },
              { "X-Retry-After": String(retryAfter) },
            );
          }
        }

        const user = await prisma.user.findUnique({
          where: { username: body.username.trim().toLowerCase() },
          select: {
            disabledAt: true,
            employee: { select: { employmentStatus: true } },
          },
        });
        const blocked =
          user !== null &&
          (user.disabledAt !== null ||
            user.employee?.employmentStatus === "TERMINATED");
        if (blocked) {
          // Spend the same time as a real password check before failing.
          await hashPassword(
            typeof body.password === "string" ? body.password : "",
          );
          throw invalidCredentials();
        }
      }),

      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-in/username") {
          const newSession = ctx.context.newSession;
          const attempted = (ctx.body as { username?: unknown } | undefined)
            ?.username;
          if (ctx.request && typeof attempted === "string") {
            const key = limiterKey(ctx, attempted);
            const userKey = UsernameBackoffLimiter.key(attempted);
            const returned = ctx.context.returned;
            if (newSession) {
              loginFailureLimiter.recordSuccess(key);
              usernameBackoffLimiter.recordSuccess(userKey);
            } else if (
              returned instanceof APIError &&
              returned.status === "UNAUTHORIZED"
            ) {
              loginFailureLimiter.recordFailure(key);
              usernameBackoffLimiter.recordFailure(userKey);
            }
          }
          if (!newSession) return;
          const mustChange = (
            newSession.user as { mustChangePassword?: unknown }
          ).mustChangePassword;
          setMustChangeHint(ctx, mustChange === true);
          return;
        }
        if (ctx.path === "/sign-out") setMustChangeHint(ctx, false);
      }),
    },

    // nextCookies must be the last plugin.
    plugins: [username(), nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
