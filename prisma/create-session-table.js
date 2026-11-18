// Pre-deploy step: create the session schema/table (prisma/legacy-session-table.sql).
// Run with a DATABASE_URL (or SESSION_DATABASE_URL) whose role may create schemas:
//   npm run db:session-table
// Idempotent. Alternatively run the .sql file with psql.
process.env.SESSION_TABLE_AUTO_CREATE = 'true';
const { ensureSessionTable, SESSION_SCHEMA } = require('../lib/session');

ensureSessionTable()
    .then(() => {
        console.log(`Session table ${SESSION_SCHEMA}.session is ready.`);
        process.exit(0);
    })
    .catch(err => {
        console.error('Could not create the session table:', err.message);
        process.exit(1);
    });
