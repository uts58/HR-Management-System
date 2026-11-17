# ADR-0001: Target stack

- Status: Accepted (revised 2026-11-17: auth library changed to Better Auth by director ruling)
- Date: 2026-11-17
- Deciders: Engineering director, Tech Lead

## Context

The legacy app is Express 4 + EJS + jQuery 2 + Bootstrap on Prisma 6/Postgres, about 2,800 lines and 33 routes. It has no tests, no role checks, plain-text passwords, GET requests that mutate data, and free-text dates. We want one typed codebase that a small team can run in Docker.

## Decision

| Concern | Choice | Notes (checked against current docs, Nov 2026) |
|---|---|---|
| Framework | Next.js 16.x, App Router | 16.4 is the current minor. Pin the minor in `package.json` and take the monthly security releases. |
| Language | TypeScript, `strict: true` | Also `noUncheckedIndexedAccess`. Contracts are checked with `exactOptionalPropertyTypes` too. |
| Data | Prisma 7 + PostgreSQL | Prisma 7 needs a driver adapter (`@prisma/adapter-pg`), the `prisma7.config.ts` CLI config, and a generated client at `web/src/generated/prisma` (imported as `@/generated/prisma/client`, not `@prisma/client`). Prisma is only imported in `web/src/server/**` and `web/prisma/**` (ADR-0003). |
| Auth | Better Auth 1.7.x (`better-auth`, `@better-auth/prisma-adapter`), username + password, database-backed sessions | Picked over Auth.js v5, which never left beta and is in maintenance now that the project is part of Better Auth. We're greenfield, so we take the maintained option. Kept behind our own `web/src/auth` API (ADR-0004). |
| UI | Tailwind CSS + shadcn/ui | Components are copied into `web/src/components/ui` (Frontend owns them). |
| Validation | Zod 4 | ADR-0005 |
| Unit/integration tests | Vitest | ADR-0008 |
| E2E tests | Playwright | ADR-0008 |
| Runtime | Node.js 26 LTS in Docker, `output: 'standalone'` | Self-hosted, no Vercel-only features. Migrations run from a separate `migrator` image target, never on app start. |
| Passwords | argon2id (`@node-rs/argon2`), legacy bcrypt verified and rehashed on login | ADR-0004 |
| Package manager | npm | One lockfile in `web/`. |

Version-specific facts we rely on:

- **Next.js 16 renamed `middleware.ts` to `proxy.ts`** (exported function `proxy`). `middleware` is deprecated. Proxy runs on the Node.js runtime by default. The ownership map's `web/src/middleware.ts` therefore becomes **`web/src/proxy.ts`** (ADR-0002).
- Next.js says Server Functions must check auth themselves and Proxy must not be the only check. Changing a matcher or moving an action to another route can silently remove Proxy coverage (ADR-0004).
- Forms use Server Actions with React 19's `useActionState`.
- `cacheComponents: true` (create-next-app 16.4 default). Request-time data (session, cookies) has to render inside `<Suspense>` and must never sit inside `'use cache'` (ADR-0004).
- Better Auth: Prisma adapter, `username` plugin, `nextCookies` plugin for server actions, `toNextJsHandler` route handler, `getSessionCookie` for optimistic proxy checks. Its built-in rate limiter applies only to HTTP requests to `/api/auth/*`, not to server-side `auth.api` calls (ADR-0004).

## Consequences

- Server Components plus Server Actions replace the Express routes. There is no separate REST API unless we need one later. Route handlers are only for Better Auth (`app/api/auth/[...all]`) and a health check.
- Teams have to keep up with Next.js monthly security releases. Platform owns Dependabot/Renovate for `web/`.
- Better Auth adds its own tables (`user`, `session`, `account`, `verification`) to the Prisma schema, which Data owns. Our `user` fields go in through `additionalFields`.
- Callers only see `web/src/auth`, so the auth library can still be replaced later without touching them.
