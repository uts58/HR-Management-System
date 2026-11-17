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

4. First time only — create the database tables and seed data:
   ```bash
   docker compose exec app npx prisma db push
   docker compose exec app npm run db:seed
   ```

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
| `TRUST_PROXY`   | unset      | Express `trust proxy` value (e.g. `1`). Set it behind a TLS-terminating proxy so HTTPS detection and rate limiting see the real client |
| `SESSION_SCHEMA` | `legacy_session` | Postgres schema for the session table |
| `SESSION_MAX_AGE_HOURS` | `8` | Session lifetime |
| `LOGIN_RATE_LIMIT_IP` / `LOGIN_RATE_LIMIT_USER` | `20` / `10` | Login attempts per 15 minutes per IP / per username |
| `BCRYPT_ROUNDS` | `12`       | bcrypt cost factor                       |

> `DATABASE_URL` is constructed automatically by Docker Compose from the above variables.

### Security notes

- **Passwords** are stored as bcrypt hashes. Existing plaintext passwords are upgraded
  automatically the next time each user logs in. To hash all remaining plaintext passwords at
  once (optional, safe to re-run):
  ```bash
  npm run db:hash-passwords -- --dry-run   # count only
  npm run db:hash-passwords
  ```
- **Sessions** are stored in Postgres in the `legacy_session.session` table. The app creates
  the schema and table at startup if they are missing (the DB user needs `CREATE` on the
  database for that). It is kept outside the `public` schema so `prisma db push` never touches
  it. To create it by hand instead:
  ```sql
  CREATE SCHEMA IF NOT EXISTS legacy_session;
  CREATE TABLE legacy_session.session (
    sid varchar NOT NULL COLLATE "default" PRIMARY KEY,
    sess json NOT NULL,
    expire timestamp(6) NOT NULL
  );
  CREATE INDEX "IDX_session_expire" ON legacy_session.session (expire);
  ```
- When adding an employee, HR sees the generated temporary password once on the confirmation
  page. Only its hash is stored.

---

## Running Locally (without Docker)

### Prerequisites
- Node.js 18+
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

4. Create the database tables and seed data:
   ```bash
   npm run db:push
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
| `npm run db:hash-passwords` | Hash any remaining plaintext passwords (one-off, optional) |
| `npm run migrate`  | Run Prisma migrations (development)                   |
| `npm run generate` | Regenerate the Prisma client after schema changes     |

---

## Contribution

Open to improvements and optimizations. Feel free to fork, submit PRs, or suggest features.
