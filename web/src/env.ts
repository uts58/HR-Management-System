import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.url().refine((v) => /^postgres(ql)?:\/\//.test(v), {
    message: "DATABASE_URL must be a postgres:// or postgresql:// URL",
  }),

  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),

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
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env: ServerEnv = parseEnv();
