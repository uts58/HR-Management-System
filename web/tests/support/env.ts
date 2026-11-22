/**
 * E2E run modes. Read once; every spec and fixture uses these flags.
 *
 * E2E_BACKEND=1   The app is wired to the real services. Specs tagged @backend run. Without it they
 *                 are SKIPPED (reported as skipped, never as passed).
 * E2E_DB_RESET=0  Don't truncate and re-seed the database before the run
 *                 (e.g. when PLAYWRIGHT_BASE_URL points at a shared deployment).
 * DATABASE_URL    Database the app under test uses. Required for the reset.
 */
export const BACKEND = process.env.E2E_BACKEND === "1";
export const DB_RESET = process.env.E2E_DB_RESET !== "0";
export const DATABASE_URL = process.env.DATABASE_URL ?? "";

/** Tag for specs that need real services, persistence or real page guards. */
export const BACKEND_TAG = "@backend";
