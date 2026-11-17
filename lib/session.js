// Postgres-backed session store for the legacy app.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const SESSION_SCHEMA = process.env.SESSION_SCHEMA || 'legacy_session';
if (!/^[a-z_][a-z0-9_]*$/.test(SESSION_SCHEMA)) {
    console.error('FATAL: SESSION_SCHEMA must be a plain lower-case identifier.');
    process.exit(1);
}
const TABLE = '"' + SESSION_SCHEMA + '"."session"';

// Note: node-postgres reads sslmode differently from Prisma; see README
// ("Database TLS"). SESSION_DATABASE_URL lets the session pool use its own URL.
const pool = new Pool({
    connectionString: process.env.SESSION_DATABASE_URL || process.env.DATABASE_URL
});

function createStore(exSession) {
    const PgSession = require('connect-pg-simple')(exSession);
    return new PgSession({
        pool,
        schemaName: SESSION_SCHEMA,
        tableName: 'session',
        // Table creation is a pre-deploy step (prisma/legacy-session-table.sql)
        // or done explicitly by ensureSessionTable() when allowed.
        createTableIfMissing: false
    });
}

/**
 * Check the session table exists. If it doesn't and SESSION_TABLE_AUTO_CREATE
 * is "true", create it (needs CREATE privilege on the database).
 * Resolves to true when the table is usable, false when it's missing.
 * Rejects only on errors other than "missing" (e.g. auto-create failed).
 */
async function ensureSessionTable() {
    const r = await pool.query('SELECT to_regclass($1) AS t', [TABLE]);
    if (r.rows[0].t !== null) return true;
    if (process.env.SESSION_TABLE_AUTO_CREATE !== 'true') return false;
    const sql = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'legacy-session-table.sql'), 'utf8')
        .replace(/legacy_session\./g, '"' + SESSION_SCHEMA + '".')
        .replace(/SCHEMA IF NOT EXISTS legacy_session;/, 'SCHEMA IF NOT EXISTS "' + SESSION_SCHEMA + '";');
    await pool.query(sql);
    return true;
}

/** Delete every session of a user except the one with sid keepSid. */
function destroyOtherSessions(userId, keepSid) {
    return pool.query(
        'DELETE FROM ' + TABLE + " WHERE sess->>'idno' = $1 AND sid <> $2",
        [String(userId), String(keepSid)]
    );
}


module.exports = { SESSION_SCHEMA, createStore, ensureSessionTable, destroyOtherSessions };
