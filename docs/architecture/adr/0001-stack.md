# ADR-0001: Target stack

- Status: Accepted
- Date: 2026-11-17
- Deciders: Engineering director, Tech Lead

## Context

The legacy app is Express 4 + EJS + jQuery 2 + Bootstrap on Prisma 6/Postgres, about 2,800 lines and 33 routes. It has no tests, no role checks, plain-text passwords, GET requests that mutate data, and free-text dates. We want one typed codebase that a small team can run in Docker.

## Decision

| Concern | Choice | Notes (checked against current docs, Nov 2026) |
|---|---|---|
| Framework | Next.js 16.x, App Router | 16.4 is the current minor. Pin the minor in `package.json` and take the monthly security releases. |
| Language | TypeScript, `strict: true` | Also `noUncheckedIndexedAccess`. Contracts are checked with `exactOptionalPropertyTypes` too. |
| Data | Prisma + PostgreSQL | The Data lead picks the Prisma major. Prisma is only imported in `web/src/server/**` and `web/prisma/**` (ADR-0003). |
| Auth | Auth.js v5 (`next-auth@beta`), Credentials provider | The Auth.js project is now part of Better Auth. v5 still works, but Security should note the migration path in their ADR. |
| UI | Tailwind CSS + shadcn/ui | Components are copied into `web/src/components/ui` (Frontend owns them). |
| Validation | Zod 4 | ADR-0005 |
| Unit/integration tests | Vitest | ADR-0008 |
| E2E tests | Playwright | ADR-0008 |
| Runtime | Node.js LTS in Docker, `output: 'standalone'` | Self-hosted, no Vercel-only features. |
| Package manager | npm | One lockfile in `web/`. |

Version-specific facts we rely on:

- **Next.js 16 renamed `middleware.ts` to `proxy.ts`** (exported function `proxy`). `middleware` is deprecated. Proxy runs on the Node.js runtime by default. The ownership map's `web/src/middleware.ts` therefore becomes **`web/src/proxy.ts`** (ADR-0002).
- Next.js says Server Functions must check auth themselves and Proxy must not be the only check. Changing a matcher or moving an action to another route can silently remove Proxy coverage (ADR-0004).
- Forms use Server Actions with React 19's `useActionState`.

## Consequences

- Server Components plus Server Actions replace the Express routes. There is no separate REST API unless we need one later. Route handlers are only for Auth.js (`app/api/auth/[...nextauth]`) and a health check.
- Teams have to keep up with Next.js monthly security releases. Platform owns Dependabot/Renovate for `web/`.
- Auth.js upstream is in maintenance under Better Auth. We use it behind our own `web/src/auth` API (ADR-0004), so we can replace it later without touching callers.
