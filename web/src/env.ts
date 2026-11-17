import { z } from "zod";

/**
 * Typed, validated server environment.
 *
 * Import `env` instead of reading `process.env` directly. Validation runs
 * the first time this module is loaded. `src/instrumentation.ts` imports it
 * when the server starts, so a misconfigured deployment fails at boot, not
 * on the first request.
 *
 * Set SKIP_ENV_VALIDATION=1 to skip validation when real secrets are not
 * available, as in `next build` inside Docker or CI lint and typecheck jobs.
 *
 * New variables go in three places: the schema below, web/.env.example,
 * and the README table.
 */

const isValidTimeZone = (tz: string): boolean => {
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

  // Organisation time zone (IANA name). Used for attendance/leave/payroll
  // day boundaries. Example: Asia/Dhaka
  APP_TIME_ZONE: z.string().default("Asia/Dhaka").refine(isValidTimeZone, {
    message: "APP_TIME_ZONE must be a valid IANA time zone, e.g. Asia/Dhaka",
  }),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

const skipValidation =
  process.env.SKIP_ENV_VALIDATION === "1" ||
  process.env.SKIP_ENV_VALIDATION === "true";

function parseEnv(): ServerEnv {
  if (skipValidation) {
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
