// Resets the database under test to the deterministic fixture in fixtures/seed.sql.
//
//   DATABASE_URL=postgresql://user:pass@host:port/db node scripts/reset-db.mjs
//
// Also used as Playwright globalSetup (see playwright.config.ts).
// Set RESET_DB=0 to skip (e.g. when pointing BASE_URL at a shared environment).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function resetDatabase() {
  if (process.env.RESET_DB === '0') {
    console.log('[reset-db] RESET_DB=0, skipping database reset');
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      '[reset-db] DATABASE_URL is not set. Point it at the database the app under test uses, ' +
        'or set RESET_DB=0 to run without a reset (tests may then not be repeatable).'
    );
  }
  const sqlFile = process.env.SEED_SQL || path.join(here, '..', 'fixtures', 'seed.sql');
  const sql = await readFile(sqlFile, 'utf8');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`[reset-db] database reset from ${path.basename(sqlFile)}`);
  } finally {
    await client.end();
  }
}

// Run directly from the CLI.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  resetDatabase().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
