#!/bin/sh
# Creates the new app's database(s) on the shared Postgres server if missing.
# Idempotent. Used in two ways:
#   - as /docker-entrypoint-initdb.d script (fresh volumes, compose.dev.yml)
#   - by the `db-init` one-shot service in docker-compose.yml (works on
#     existing legacy volumes too, where initdb scripts never re-run)
#
# WEB_DB_NAMES: space-separated list, default "hr_web".
set -eu

export PGUSER="${PGUSER:-${POSTGRES_USER:-postgres}}"
export PGDATABASE="${PGDATABASE:-${POSTGRES_DB:-postgres}}"

for db in ${WEB_DB_NAMES:-hr_web}; do
  case "$db" in
    *[!a-zA-Z0-9_]*) echo "Refusing unsafe database name: $db" >&2; exit 1 ;;
  esac
  exists=$(psql -v ON_ERROR_STOP=1 -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'")
  if [ "$exists" = "1" ]; then
    echo "Database $db already exists"
  else
    echo "Creating database $db (owner $PGUSER)"
    psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$db\" OWNER \"$PGUSER\""
  fi
done
