import { z } from "zod";

/**
 * Typed, validated server environment.
 *
 * Import `env` instead of reading `process.env` directly. Validation runs
 * the first time this module is loaded. `src/instrumentation.ts` imports it
 * when the server starts, so a misconfigured deployment fails at boot, not
 * on the first request.
 *
 * SKIP_ENV_VALIDATION=1 is honoured ONLY during `next build` (NEXT_PHASE is
 * "phase-production-build"), where real secrets are not available, and in
 * Vitest unit runs. At runtime the flag is ignored with a loud warning and
 * validation runs anyway, so it can never switch validation off in a
 * deployed server.
 *
 * New variables go in: the schema below, web/.env.example, the README table,
 * and the `web` service in docker-compose.yml.
 */

// IANA zone name such as "Asia/Dhaka" or "UTC". Fixed offsets like "+06:00"
// are rejected because they ignore DST rules.
const isValidIanaTimeZone = (tz: string): boolean => {
  if (/^[+-]/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Postgres connection string for the NEW app database (not the legacy one).
  DATABASE_URL: z.url().refine((v) => /^postgres(ql)?:\/\//.test(v), {
    message: "DATABASE_URL must be a postgres:// or postgresql:// URL",
  }),

  // Better Auth: secret must be >= 32 chars of high entropy.
  // Generate with: openssl rand -base64 32
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  // Public base URL of the app, e.g. http://localhost:3000 or https://hr.example.com
  BETTER_AUTH_URL: z.url(),

  // REQUIRED, no default: the organisation's IANA time zone. The database
  // stores UTC; this zone only defines the business day (attendance, leave,
  // "today"). It must be set explicitly for every deployment.
  APP_TIME_ZONE: z
    .string({ error: "APP_TIME_ZONE is required (IANA zone, e.g. Asia/Dhaka)" })
    .refine(isValidIanaTimeZone, {
      message: "APP_TIME_ZONE must be a valid IANA time zone, e.g. Asia/Dhaka",
    }),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function shouldSkipValidation(): boolean {
  const flag = process.env.SKIP_ENV_VALIDATION;
  if (flag !== "1" && flag !== "true") return false;

  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  const isVitest = process.env.VITEST === "true";
  if (isBuild || isVitest) return true;

  console.warn(
    [
      "",
      "!!! ================================================================ !!!",
      "!!! SKIP_ENV_VALIDATION is set at RUNTIME. It is only honoured during !!!",
      "!!! `next build`. Ignoring it and validating the environment anyway.  !!!",
      "!!! Remove SKIP_ENV_VALIDATION from this deployment's environment.    !!!",
      "!!! ================================================================ !!!",
      "",
    ].join("\n"),
  );
  return false;
}

function parseEnv(): ServerEnv {
  if (shouldSkipValidation()) {
    return process.env as unknown as ServerEnv;
  }
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    // Fail fast and loudly. Never print the values, which may be secrets.
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env: ServerEnv = parseEnv();
