-- Session store table for the legacy Express app (connect-pg-simple layout).
-- Run once before deploying, as a role that may create schemas, e.g.:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/legacy-session-table.sql
-- It lives outside the "public" schema so `prisma db push` never touches it.
-- If you use a SESSION_SCHEMA other than legacy_session, replace the name below.
-- Idempotent: safe to re-run.

CREATE SCHEMA IF NOT EXISTS legacy_session;

CREATE TABLE IF NOT EXISTS legacy_session.session (
    sid    varchar      NOT NULL COLLATE "default",
    sess   json         NOT NULL,
    expire timestamp(6) NOT NULL,
    CONSTRAINT session_pkey PRIMARY KEY (sid)
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON legacy_session.session (expire);

-- If the app connects as a different role than the one running this script,
-- grant it access (replace app_user):
--   GRANT USAGE ON SCHEMA legacy_session TO app_user;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON legacy_session.session TO app_user;
