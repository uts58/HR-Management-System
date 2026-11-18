## Node.js HR Management System

HR management system built with Node.js, Express, PostgreSQL, and Prisma ORM.

## Overview

Navigate and manage HR functionalities with ease. Whether you're an Admin, HR, or an Employee, the system offers tailored features to cater to your needs.

## Features

**1. User Roles:**
- **Admin:** Highest level of access with capabilities to add and manage HR users.
- **HR:** Central role with authority to add and manage regular users or employees.
- **Employee:** General user role with access to personal details, notices, and more.

**2. Notice Panel:** Broadcast important notices, updates, or announcements to employees.

**3. Database Integration:** PostgreSQL via Prisma ORM for reliable data storage and efficient retrieval.

---

## Running with Docker (Recommended)

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/uts58/HR-Management-System.git
   cd HR-Management-System
   ```

2. Copy the example env file and set your password:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and change `DB_PASS` and `SESSION_SECRET` to secure values.

3. Build and start:
   ```bash
   docker compose up --build
   ```

4. First time only — create the database tables, the session table and seed data:
   ```bash
   docker compose exec app npx prisma db push
   docker compose exec app npm run db:session-table
   docker compose exec app npm run db:seed
   ```
   Until the session table exists the app exits at startup with a message saying so, and
   Docker restarts it (`restart: unless-stopped`). If that loop prevents `exec`, create the
   table from the host instead:
   `docker compose exec -T db psql -U hruser -d hrdb -v ON_ERROR_STOP=1 < prisma/legacy-session-table.sql`

   Default credentials after seeding:
   | Role | Username | Password |
   |------|----------|----------|
   | HR Admin | `admin` | `admin123` |
   | Employee | `john` | `emp123` |

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

| Variable        | Default    | Description                              |
|-----------------|------------|------------------------------------------|
| `DB_NAME`       | `hrdb`     | Database name                            |
| `DB_USER`       | `hruser`   | Database user                            |
| `DB_PASS`       | —          | Database password **(required)**         |
| `PORT`          | `3000`     | Application port                         |
| `SESSION_SECRET` | —         | Session signing secret **(required; the app refuses to start in production without it)** |
| `COOKIE_SECURE` | `auto`     | Session cookie `Secure` flag: `auto` (Secure when the request is HTTPS), `true`, `false` |
| `TRUST_PROXY`   | unset      | Number of reverse-proxy hops in front of the app. **In production behind a reverse proxy / load balancer, set the exact hop count (usually `1`). Never set it to `true`** (that trusts any client-supplied `X-Forwarded-For`, so clients can fake their IP and bypass the login rate limit; the app refuses to start with `true`). Leave unset only when clients connect directly. The app logs a warning in production when it is unset |
| `SESSION_SCHEMA` | `legacy_session` | Postgres schema for the session table |
| `SESSION_TABLE_AUTO_CREATE` | `false` | `true` lets the app create the session schema/table at startup (needs `CREATE` on the database). Otherwise create it before deploying (see below) |
| `SESSION_DATABASE_URL` | `DATABASE_URL` | Connection string for the session store only (see "Database TLS") |
| `SESSION_MAX_AGE_HOURS` | `8` | Session idle lifetime (rolling: renewed on each request) |
| `LOGIN_RATE_LIMIT_IP` / `LOGIN_RATE_LIMIT_USER` | `20` / `10` | Login attempts per 15 minutes per IP / per username from the same IP |
| `BCRYPT_ROUNDS` | `12`       | bcrypt cost factor                       |

> `DATABASE_URL` is constructed automatically by Docker Compose from the above variables.

### Security notes

- **Passwords** are stored as bcrypt hashes (`$2b$`, via the native `@node-rs/bcrypt`).
  Existing plaintext passwords are upgraded automatically the next time each user logs in.
  To hash all remaining plaintext passwords at once (optional, safe to re-run):
  ```bash
  npm run db:hash-passwords -- --dry-run   # count only
  npm run db:hash-passwords
  ```
- **Login names are not unique** (`person.Name`). Login checks at most 10 accounts with the
  same name (case-insensitive) against the password; an 11th same-named account could not log in.
- When adding an employee, HR sees the generated temporary password once on the confirmation
  page. Only its hash is stored. Editing an employee never changes their login name.
- Changing a password signs out the user's other sessions.

### Deploying this release (pre-deploy steps and rollback)

1. **Create the session table before deploying.** Sessions are stored in Postgres in
   `legacy_session.session`, outside the `public` schema so `prisma db push` never touches it.
   Run once, as a role that may create schemas (idempotent):
   ```bash
   npm run db:session-table          # or:
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/legacy-session-table.sql
   ```
   If the app connects as a different role, grant it `USAGE` on the schema and
   `SELECT, INSERT, UPDATE, DELETE` on the table (see the end of the .sql file). The app
   itself needs no `CREATE` privilege. At startup it only checks the table exists and exits
   with a clear message if it does not (unless `SESSION_TABLE_AUTO_CREATE=true`). If the
   database is unreachable at startup it logs a warning and starts anyway.
2. Set `SESSION_SECRET`, and `TRUST_PROXY` (exact hop count) if behind a proxy.
3. Deploy. Everyone has to log in once (sessions move from memory to Postgres).
4. **No rollback after the first login.** Every successful login converts that user's
   plaintext password to a bcrypt hash, and the old code can only compare plaintext. Once any
   password is hashed, redeploying the old code locks those users out. Roll back only with a
   database restore taken before the deploy (losing data written since), or by resetting the
   affected passwords. Fix forward instead.
5. Run `npm run db:hash-passwords` **only after the release is confirmed stable**. It hashes
   every remaining plaintext password, after which a rollback would lock out everyone.

### Database TLS (`sslmode`) — Prisma vs node-postgres

The session store uses node-postgres (`pg`), which reads `sslmode` in `DATABASE_URL`
differently from Prisma 6:

| `sslmode` in URL | Prisma 6 | node-postgres 8 (`pg-connection-string` 2.x) |
|---|---|---|
| (none) | `prefer` (default): TLS if available | no TLS |
| `prefer` | TLS if available, else plaintext | TLS required **and** certificate + hostname verified (treated as `verify-full`) |
| `require` | TLS required; certificate not verified (`sslaccept` defaults to `accept_invalid_certs`) | TLS required **and** certificate + hostname verified (treated as `verify-full`) |
| `require&uselibpqcompat=true` | (Prisma does not document this parameter) | TLS required, certificate not verified (libpq semantics) |

Sources: Prisma 6 PostgreSQL connection arguments docs; `pg-connection-string` README
(it also prints a warning that `prefer`/`require`/`verify-ca` are aliases for `verify-full`).
Consequences:
- With `sslmode=require` and a certificate Node does not trust (e.g. a managed database's
  private CA), Prisma connects but the session store fails. Fix properly by making `pg` trust
  the CA: `NODE_EXTRA_CA_CERTS=/abs/path/ca.pem`, or `sslrootcert=/abs/path/ca.pem` in the URL
  (use an absolute path: Prisma resolves certificate paths relative to `./prisma`, `pg` relative
  to the working directory). Prisma only verifies the certificate if you also add
  `sslaccept=strict`. As a stopgap, set `SESSION_DATABASE_URL` to the same URL with
  `&uselibpqcompat=true`, which matches Prisma's unverified behaviour.
- With no `sslmode`, Prisma may use TLS while `pg` connects without it. Put an explicit
  `sslmode` in production URLs.
- Prisma-only parameters such as `schema=public` and `connection_limit` are ignored by `pg`
  (tested).

---

## Running Locally (without Docker)

### Prerequisites
- Node.js 22+ (Docker image uses Node 26)
- PostgreSQL 16+

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/uts58/HR-Management-System.git
   cd HR-Management-System
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example env file and update `DATABASE_URL` for your local Postgres:
   ```bash
   cp .env.example .env
   ```

4. Create the database tables, the session table and seed data:
   ```bash
   npm run db:push
   npm run db:session-table
   npm run db:seed
   ```

5. Start the application:
   ```bash
   npm start
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## NPM Scripts

| Script             | Description                                           |
|--------------------|-------------------------------------------------------|
| `npm start`        | Start the application                                 |
| `npm run db:push`  | Push the Prisma schema to the database (no migration history) |
| `npm run db:seed`  | Seed departments, positions, admin user, and sample employee |
| `npm run db:session-table` | Create the Postgres session schema/table (pre-deploy, idempotent) |
| `npm run db:hash-passwords` | Hash any remaining plaintext passwords (one-off, optional; only after the release is stable) |
| `npm run migrate`  | Run Prisma migrations (development)                   |
| `npm run generate` | Regenerate the Prisma client after schema changes     |

---

## Contribution

Open to improvements and optimizations. Feel free to fork, submit PRs, or suggest features.
