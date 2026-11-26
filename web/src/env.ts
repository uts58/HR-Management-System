import "server-only";

import { z } from "zod";
import { dbSchema, parseEnvWith } from "./db-env";

const serverSchema = dbSchema.extend({
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export const env: ServerEnv = parseEnvWith(serverSchema);
