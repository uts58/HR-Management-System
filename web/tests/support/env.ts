export const BACKEND = process.env.E2E_BACKEND === "1";
export const DB_RESET = process.env.E2E_DB_RESET !== "0";
export const DATABASE_URL = process.env.DATABASE_URL ?? "";

export const BACKEND_TAG = "@backend";
