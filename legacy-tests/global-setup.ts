import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** Runs scripts/reset-db.mjs in a child process (same script as `npm run db:reset`). */
export default function globalSetup() {
  execFileSync(process.execPath, [path.join(__dirname, 'scripts', 'reset-db.mjs')], {
    stdio: 'inherit',
    env: process.env,
  });
}
