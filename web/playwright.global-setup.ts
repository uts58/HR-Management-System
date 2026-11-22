import { randomUUID } from "node:crypto";

import { ensureDatabaseReset } from "./tests/support/db/reset";

export default async function globalSetup(): Promise<void> {
  process.env.E2E_RUN_ID ??= `global-${randomUUID()}`;
  await ensureDatabaseReset();
}
