// Playwright globalSetup. Resets the E2E database once, before any worker
// starts, using tests/support/db/reset.ts: TRUNCATE, then the seed, then the
// QA fixtures. It refuses databases not named *_test or *_it.
//
// It goes through ensureDatabaseReset(), which calls resetDatabase() and
// records a per-run stamp. E2E_RUN_ID is set here, and workers inherit it,
// so the worker fixture in tests/support/fixtures.ts sees the stamp and
// does not reset a second time.
//
// Skipped when E2E_DB_RESET=0, e.g. when PLAYWRIGHT_BASE_URL points at a
// shared deployment.
import { randomUUID } from "node:crypto";

import { ensureDatabaseReset } from "./tests/support/db/reset";

export default async function globalSetup(): Promise<void> {
  process.env.E2E_RUN_ID ??= `global-${randomUUID()}`;
  await ensureDatabaseReset();
}
