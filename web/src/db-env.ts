import { z } from "zod";

export const dbSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  DATABASE_URL: z.url().refine((v) => /^postgres(ql)?:\/\//.test(v), {
    message: "DATABASE_URL must be a postgres:// or postgresql:// URL",
  }),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

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

export function parseEnvWith<S extends z.ZodType>(schema: S): z.infer<S> {
  if (shouldSkipValidation()) {
    return process.env as unknown as z.infer<S>;
  }
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export type DbEnv = z.infer<typeof dbSchema>;

export const dbEnv: DbEnv = parseEnvWith(dbSchema);
