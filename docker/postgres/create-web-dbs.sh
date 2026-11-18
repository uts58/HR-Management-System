#!/bin/sh
# Provisions the new app's least-privilege role and database(s) on the
# shared Postgres server. Idempotent, so it is safe to re-run. Used in two
# ways:
#   - as a /docker-entrypoint-initdb.d script (fresh volumes, compose.dev.yml)
#   - by the `db-init` one-shot service in docker-compose.yml. This also
#     works on existing legacy volumes, where initdb scripts never re-run.
#
# Must connect as a role allowed to create roles and databases (the
# Postgres superuser from POSTGRES_USER / PGUSER).
#
# Env:
#   WEB_DB_USER      login role for the new app (default hr_web_app)
#   WEB_DB_PASS      its password (required; also rotated on every run)
#   WEB_DB_NAMES     space-separated databases owned by that role (default hr_web)
#   WEB_DB_CREATEDB  1 = grant CREATEDB (dev only: `prisma migrate dev` needs
#                    it for its shadow database). Default 0.
#   LEGACY_DB_NAME   optional: revoke PUBLIC CONNECT on the legacy database
#                    so the web role cannot connect to it at all.
#
# The web role is NOSUPERUSER NOCREATEROLE. It owns only its own databases,
# so on PG15+ it also owns their `public` schema via pg_database_owner.
set -eu

export PGUSER="${PGUSER:-${POSTGRES_USER:-postgres}}"
export PGDATABASE="${PGDATABASE:-${POSTGRES_DB:-postgres}}"

WEB_DB_USER="${WEB_DB_USER:-hr_web_app}"
WEB_DB_NAMES="${WEB_DB_NAMES:-hr_web}"
WEB_DB_CREATEDB="${WEB_DB_CREATEDB:-0}"
: "${WEB_DB_PASS:?WEB_DB_PASS must be set (password for the web app role)}"

is_safe_ident() {
  case "$1" in
    ''|*[!a-zA-Z0-9_]*) return 1 ;;
    *) return 0 ;;
  esac
}

for ident in "$WEB_DB_USER" $WEB_DB_NAMES ${LEGACY_DB_NAME:-}; do
  is_safe_ident "$ident" || { echo "Refusing unsafe identifier: $ident" >&2; exit 1; }
done

if [ "$WEB_DB_CREATEDB" = "1" ]; then createdb_opt=CREATEDB; else createdb_opt=NOCREATEDB; fi

psql_q() { psql -v ON_ERROR_STOP=1 -X -q "$@"; }

# --- role --------------------------------------------------------------------
role_exists=$(psql_q -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$WEB_DB_USER'")
if [ "$role_exists" != "1" ]; then
  echo "Creating role $WEB_DB_USER"
  psql_q -c "CREATE ROLE \"$WEB_DB_USER\" LOGIN"
fi
# The password goes through a psql variable on stdin, so it is never
# interpolated into SQL by the shell and never appears in `ps`.
psql_q -v pw="$WEB_DB_PASS" <<SQL
ALTER ROLE "$WEB_DB_USER" WITH LOGIN NOSUPERUSER NOCREATEROLE $createdb_opt NOREPLICATION NOBYPASSRLS PASSWORD :'pw';
SQL

# --- databases ---------------------------------------------------------------
for db in $WEB_DB_NAMES; do
  exists=$(psql_q -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'")
  if [ "$exists" = "1" ]; then
    echo "Database $db exists; ensuring owner $WEB_DB_USER"
    psql_q -c "ALTER DATABASE \"$db\" OWNER TO \"$WEB_DB_USER\""
  else
    echo "Creating database $db (owner $WEB_DB_USER)"
    psql_q -c "CREATE DATABASE \"$db\" OWNER \"$WEB_DB_USER\""
  fi
  # Only the owner (and superusers) may connect.
  psql_q -c "REVOKE ALL ON DATABASE \"$db\" FROM PUBLIC"
done

# --- keep the web role out of the legacy database ----------------------------
if [ -n "${LEGACY_DB_NAME:-}" ]; then
  echo "Revoking PUBLIC CONNECT on legacy database $LEGACY_DB_NAME"
  psql_q -c "REVOKE CONNECT ON DATABASE \"$LEGACY_DB_NAME\" FROM PUBLIC"
fi
