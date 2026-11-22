import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { hash as argon2Hash } from "@node-rs/argon2";
import pg from "pg";

import { DATABASE_URL, DB_RESET } from "../env";
import { QA_PASSWORD } from "../users";

const WEB_DIR = path.resolve(__dirname, "../../..");
const LOCK_KEY = 72_026_117;

async function truncateAll(client: pg.Client) {
  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length === 0) {
    throw new Error(
      "No tables in the public schema. Run `npx prisma migrate deploy` first.",
    );
  }
  const list = rows.map((r) => `"${r.tablename}"`).join(", ");
  await client.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

function runDataSeed() {
  const tsxCli = path.join(WEB_DIR, "node_modules", "tsx", "dist", "cli.mjs");
  execFileSync(process.execPath, [tsxCli, "prisma/seed.ts"], {
    cwd: WEB_DIR,
    env: { ...process.env, DATABASE_URL },
    stdio: "pipe",
  });
}

async function loadQaFixtures(client: pg.Client) {
  const hash = await argon2Hash(QA_PASSWORD);
  const sql = readFileSync(path.join(__dirname, "qa-fixtures.sql"), "utf8")
    .split("{{QA_HASH}}")
    .join(hash);
  await client.query(sql);
}

export function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!/_(test|it)$/.test(name)) {
    throw new Error(
      `Refusing to reset database "${name}": E2E only truncates databases named *_test or *_it (ADR-0008).`,
    );
  }
}

export async function resetDatabase(client?: pg.Client): Promise<void> {
  assertTestDatabase(DATABASE_URL);
  const own = !client;
  const c = client ?? new pg.Client({ connectionString: DATABASE_URL });
  if (own) await c.connect();
  try {
    await truncateAll(c);
    runDataSeed();
    await loadQaFixtures(c);
  } finally {
    if (own) await c.end();
  }
}

export async function ensureDatabaseReset(): Promise<void> {
  if (!DB_RESET) return;
  if (!DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. The E2E suite resets and seeds the app's database before running; " +
        "point DATABASE_URL at the same throwaway database the app uses, or set E2E_DB_RESET=0.",
    );
  }
  const runId = `${process.env.E2E_RUN_ID ?? process.ppid}`;
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS qa_e2e`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS qa_e2e.runs (run_id text PRIMARY KEY, reset_at timestamptz NOT NULL DEFAULT now())`,
    );
    const done = await client.query(
      "SELECT 1 FROM qa_e2e.runs WHERE run_id = $1",
      [runId],
    );
    if (done.rowCount === 0) {
      await resetDatabase(client);
      await client.query("DELETE FROM qa_e2e.runs");
      await client.query("INSERT INTO qa_e2e.runs (run_id) VALUES ($1)", [
        runId,
      ]);
    }
  } finally {
    await client
      .query("SELECT pg_advisory_unlock($1)", [LOCK_KEY])
      .catch(() => {});
    await client.end();
  }
}

if (require.main === module) {
  resetDatabase()
    .then(() => console.log("E2E database reset: seed + QA fixtures loaded."))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
