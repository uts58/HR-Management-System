# Deployment topology and cutover runbook

Owner: Platform / DevOps. Status: **draft (Phase 0)**.

## 1. Target topology

```
                 Internet
                    │  443 (HTTPS), 80 → 301 to 443
          ┌─────────▼──────────┐
          │  Reverse proxy     │  Caddy (preferred: automatic Let's Encrypt)
          │  TLS termination   │  or nginx + certbot
          └─────────┬──────────┘
                    │ http://web:3000  (internal Docker network only)
   ┌────────────────▼────────────────┐       ┌──────────────────────┐
   │  web  (hr-web image, runner)     │       │ web-migrate (one-shot)│
   │  Next.js standalone, uid 1001    │       │ prisma migrate deploy │
   │  read-only rootfs, /api/health   │       └──────────┬───────────┘
   └────────────────┬────────────────┘                  │
                    │ 5432 (internal network only)      │
          ┌─────────▼───────────────────────────────────▼┐
          │  Postgres 16  (named volume on local disk)   │
          │   ├─ hr_web   new app                        │
          │   └─ hrdb     legacy (read-only after cutover)│
          └─────────┬────────────────────────────────────┘
                    │ nightly pg_dump + WAL archive
          ┌─────────▼──────────┐
          │ Off-host backups   │  S3-compatible bucket / backup server
          └────────────────────┘
```

**Host:** a single Linux VM with Docker Engine and the Compose plugin, at
least 2 vCPU, 4 GB RAM and an SSD. Start the stack with:

```bash
docker compose -f docker-compose.yml -f compose.prod.yml --profile web up -d
```

`docker-compose.yml` is the base. The production override
[`compose.prod.yml`](../../compose.prod.yml) adds Caddy, unpublishes the
app ports (`ports: !reset []`), sets `TRUST_PROXY=1` for the legacy app, and
derives `BETTER_AUTH_URL` from `APP_DOMAIN`.

**Reverse proxy (Caddy, [`docker/caddy/Caddyfile`](../../docker/caddy/Caddyfile)):**

- Caddy obtains and renews Let's Encrypt certificates for `APP_DOMAIN`
  automatically and redirects HTTP to HTTPS. It sends HSTS
  (`max-age=31536000; includeSubDomains`), `nosniff` and a referrer policy.
- `UPSTREAM` picks the backend: `app:3000` (legacy, the default) or
  `web:3000`. Changing it is the cutover switch.
- `BETTER_AUTH_URL` must equal the public `https://` origin.
- Only Caddy publishes ports (80, 443/tcp, 443/udp). `app`, `web` and `db`
  are reachable only on the internal Docker network.
- Optional: rate-limit `/api/auth/*` (needs a Caddy rate-limit plugin) or
  rely on Better Auth's built-in rate limiter.

**Forwarded headers and client IPs:**

- **Caddy overwrites `X-Forwarded-For`.** No `trusted_proxies` is
  configured, so Caddy discards client-supplied `X-Forwarded-For`,
  `X-Forwarded-Proto` and `X-Forwarded-Host` (anti-spoofing) and sets them
  itself. `X-Forwarded-For` then holds exactly one address, the TCP peer
  that connected to Caddy, and `X-Forwarded-Proto` is `https`.
- Because there is exactly one trusted hop, the legacy app runs with
  **`TRUST_PROXY=1`** (Express `trust proxy` = 1, set in `compose.prod.yml`).
  `req.ip` and `req.secure` then come from Caddy's headers and cannot be
  spoofed by clients. Better Auth in the new app reads the client IP from
  `X-Forwarded-For` for rate limiting, which is safe for the same reason.
- If a CDN or load balancer is ever placed in front of Caddy, add its ranges
  to Caddy's `trusted_proxies` and raise the hop count (TRUST_PROXY=2, and
  the equivalent Better Auth setting) together. Changing only one of them
  either lets clients spoof their IP or makes every request look as if it
  came from the CDN.
- Never publish `app` or `web` ports directly in production. A client that
  reaches the app without going through Caddy can set any
  `X-Forwarded-For` it likes.

**Database roles:**

- The legacy app keeps its existing credentials (`DB_USER`, the Postgres
  superuser created by the image).
- The new app connects as **`hr_web_app`** (`WEB_DB_USER`/`WEB_DB_PASS`).
  It is a `NOSUPERUSER NOCREATEDB NOCREATEROLE` login role that owns only
  the `hr_web` database. On PG15+ that also makes it owner of the database's
  `public` schema, so `prisma migrate deploy` can run DDL.
- The `db-init` job ([`docker/postgres/create-web-dbs.sh`](../../docker/postgres/create-web-dbs.sh))
  creates the role and database idempotently. It rotates the role's password
  to `WEB_DB_PASS` on every run and revokes `CONNECT` from `PUBLIC` on both
  `hr_web` and `hrdb`, so the web role cannot even connect to the legacy
  database. `db-init` is the only web-profile service that uses superuser
  credentials.
- The legacy data migration (`scripts/migrate-legacy/`) reads `hrdb` with
  the legacy credentials and writes `hr_web` as `hr_web_app`.

**App containers:**

- `web` runs the image built from `web/Dockerfile` (target `runner`). It runs
  as non-root (uid 1001) with a read-only rootfs plus tmpfs for `/tmp` and
  `.next/cache`, and it is restarted with `unless-stopped`.
- The `HEALTHCHECK` calls `GET /api/health`. Once `UPSTREAM` points at
  `web`, the proxy health check should call the same endpoint.
- Env validation happens at boot (`src/env.ts`). A bad config makes the
  container exit, so nothing broken gets served. `SKIP_ENV_VALIDATION` is
  honoured only during `next build`. At runtime it is ignored with a loud
  warning.
- **Time zones:** there is no company time zone. Timestamps are stored in
  UTC and rendered in each viewer's browser zone. Server-side date handling
  is deterministic because every web container runs with `TZ=UTC`, set in
  `web/Dockerfile` and in compose. Don't override it per deployment.
- **Migrations run as a separate step.** The `web-migrate` image (target
  `migrator`) runs `prisma migrate deploy` once per release, before the new
  `web` image starts. Compose enforces the order with
  `service_completed_successfully`. Migrations must be backward-compatible
  with the previous release (expand/contract) so that a rollback only needs
  the old image.
- Images are tagged by git SHA, for example `hr-web:<sha>`. Never deploy
  `:latest`.

**Secrets:** `BETTER_AUTH_SECRET`, the DB password and so on live in a
root-only `.env` on the host, or in Docker secrets. They are never committed
and never baked into images, because the build uses `SKIP_ENV_VALIDATION=1`
and carries no secrets.

**Postgres backups:**

| What                    | How                                                         | Retention         |
| ----------------------- | ----------------------------------------------------------- | ----------------- |
| Nightly logical dump    | `pg_dump -Fc hr_web` (and `hrdb` until decommission) via cron/sidecar, encrypted, shipped off-host | 30 daily, 12 monthly |
| Point-in-time recovery  | WAL archiving (e.g. `wal-g` / `pgBackRest`) to object storage | 7–14 days         |
| Pre-deploy snapshot     | `pg_dump -Fc` before every release that contains migrations | 5 most recent     |
| Restore drill           | Restore the latest dump into a scratch container and run smoke tests | Monthly |

A backup counts only after a restore from it has been tested. Record the
date of each drill.

**Observability (minimum):** container logs go to journald or Loki through
the Docker logging driver, and the app writes JSON logs at `LOG_LEVEL`. Add
uptime monitoring on `https://hr.example.com/api/health`, alerts on disk
usage for the DB volume, and alerts on backup job failure.

## 2. Environments

| Env        | How                                                                 |
| ---------- | ------------------------------------------------------------------- |
| Local dev  | `compose.dev.yml` (Postgres only) + `npm run dev` on the host        |
| CI         | GitHub Actions with a Postgres service container (`.github/workflows/ci.yml`) |
| Staging    | Same compose stack as prod on a separate host/DB, restored from an anonymised prod dump |
| Production | Single Docker host as above                                          |

## 3. Cutover runbook (outline, to be detailed in later phases)

### T-2 weeks: readiness

- [ ] Feature parity sign-off against the legacy route inventory (QA + Architect).
- [ ] Data migration scripts (`scripts/migrate-legacy/`) are idempotent and
      have been rehearsed at least twice on staging with a fresh prod dump.
      Row counts and checksums reconcile.
- [ ] Password strategy agreed with Security. Legacy hashes are migrated or
      users are forced to reset, and users have been told.
- [ ] Prod host is provisioned. TLS works on a temporary hostname. Backups
      are running and a restore has been tested.
- [ ] Rollback plan reviewed and the go/no-go owner named.

### T-1 day

- [ ] Announce the maintenance window.
- [ ] Freeze legacy deploys.
- [ ] Build and tag the release images (`hr-web:<sha>`, `hr-web-migrate:<sha>`)
      and pull them onto the host.
- [ ] Lower the DNS TTL if the hostname changes.

### T-0: cutover window

1. Put the legacy app into maintenance or read-only mode. Stop the `app`
   container, or have the proxy serve a maintenance page.
2. Take a final `pg_dump -Fc hrdb` and keep it as the rollback point.
3. `docker compose run --rm db-init`, then `docker compose run --rm web-migrate`
   to bring the `hr_web` schema up to date.
4. Run the legacy data migration (`scripts/migrate-legacy/`) from `hrdb` into
   `hr_web`, then the reconciliation report. **Go/no-go checkpoint.**
5. `docker compose --profile web up -d web`. Wait for it to report healthy.
6. Smoke tests: log in for each role, run the key HR flows, and run
   Playwright against prod (`PLAYWRIGHT_BASE_URL`) with a test account.
7. Set `UPSTREAM=web:3000` and recreate Caddy (`docker compose -f docker-compose.yml -f compose.prod.yml up -d caddy`). Optionally
   redirect legacy URLs to the new routes.
8. Watch logs, error rate and `/api/health` for 60 minutes.

### Rollback (any time before the end of the T+1 week stabilisation period)

1. Point the proxy back to the legacy `app` and start it.
2. Legacy `hrdb` has been read-only since step 1, so no data loss is
   expected for that period. Writes made in the new app after cutover must
   be exported and replayed manually. Keep a log of them.
3. Post-mortem before attempting again.

### T+1 week to T+1 month: decommission

- [ ] Remove the `app` service from compose. Archive `hrdb` with a final dump
      kept for N years per HR retention policy, then drop it.
- [ ] Remove the legacy code from the repo (separate PR) and the `legacy` CI job.
- [ ] Move `web/` to the repo root if desired.
- [ ] **Re-enable Dependabot.** The user turned it off for the duration of
      the migration.
      1. Turn it back on:
         `gh api -X PUT repos/uts58/HR-Management-System/vulnerability-alerts`
         and
         `gh api -X PUT repos/uts58/HR-Management-System/automated-security-fixes`.
      2. Restore `.github/dependabot.yml` if one was removed. None existed when
         Dependabot was turned off.
      3. Triage open alerts. Known: #49, minimatch via shadcn, dev-only.
      4. Close the obsolete legacy bump PRs #17 (morgan, since removed) and #15
         (qs/body-parser/express), because the legacy app is retired.

## 4. Open questions

- Which hostname and certificate source? Is the deployment internal-only
  behind a VPN, or public?
- Backup target (S3 provider or on-premises) and the retention required by
  HR or legal.
- Is a single host enough? Are there uptime SLOs that would justify a
  managed Postgres or a second app node?
