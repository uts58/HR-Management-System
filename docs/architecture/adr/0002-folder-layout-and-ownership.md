# ADR-0002: Folder layout and ownership

- Status: Accepted
- Date: 2026-11-17

## Decision

The new app lives in `web/` next to the legacy app until cutover. Each path has one owning lead. Others change it only through a PR the owner approves (enforce with `CODEOWNERS`, which Platform owns).

```
/                          legacy app (Express) - frozen except security patches (Security) and tests (QA)
├─ legacy-tests/           QA: characterisation tests against the legacy app
├─ scripts/migrate-legacy/ Data: one-off legacy -> new data migration
├─ docs/architecture/      Tech Lead: ADRs, contracts.md, feature-map.md
├─ .github/, Dockerfile*, docker-compose*.yml   Platform
└─ web/
   ├─ package.json, next.config.ts, tsconfig.json, eslint/tailwind/vitest/playwright config   Platform
   ├─ prisma/              Data: schema.prisma, migrations, seed
   ├─ tests/               QA: e2e (Playwright), shared fixtures, auth-matrix tests
   └─ src/
      ├─ proxy.ts          Security (Next 16 name; replaces middleware.ts in the ownership map)
      ├─ auth/             Security: Auth.js config, getSession/requireRole, password hashing
      ├─ contracts/        Tech Lead: type-only service + auth contracts
      ├─ server/           Backend: services, Prisma client, errors, action wrapper
      │  ├─ db.ts          the single PrismaClient instance
      │  ├─ errors.ts      ServiceError, toActionResult()
      │  └─ <domain>/      employee | org | leave | notice | performance
      │     ├─ service.ts  implements the contract interface
      │     └─ *.test.ts   Vitest, colocated
      ├─ lib/
      │  ├─ validation/    Backend: Zod schemas, one file per domain
      │  └─ dates.ts       Backend (proposed): IsoDate helpers and formatter (ADR-0007)
      ├─ app/              Frontend: routes, layouts, pages, and the server actions
      │  └─ (domain)/…/actions.ts   'use server' files colocated with the route that uses them
      └─ components/       Frontend: shadcn/ui in components/ui, feature components next to it
```

### Who writes server actions?

Server actions are thin glue in `web/src/app/**/actions.ts`, so Frontend owns the files. Each action does exactly four things (ADR-0003):
`requireRole()` → Zod `safeParse` → call a service → `revalidatePath`/`redirect` and return `ActionResult`.
If an action needs more than that, the extra logic goes into the service (Backend).

### Import rules (Platform enforces them with ESLint `no-restricted-imports`)

| Module | May import from |
|---|---|
| `contracts/` | nothing (only other contract files) |
| `lib/validation/` | `zod`, `contracts/` |
| `server/` | `contracts/`, `lib/`, `@prisma/client`/generated client, `auth/` types only |
| `auth/` | `contracts/`, `lib/`, `server/db.ts` (to look up users) |
| `app/` | `auth/`, `server/` (only from server components/actions), `lib/`, `contracts/`, `components/` |
| `components/` | `contracts/`, `lib/validation/`, `components/`. **Never** `server/`, `auth/` or Prisma |

`server/**` and `auth/**` start with `import 'server-only'`.

## Consequences

- One owner per path keeps merges predictable while leads work in parallel.
- Moving `middleware.ts` to `proxy.ts` has to be confirmed by the director and Security (open question).
- `web/src/lib/` outside `validation/` has no named owner. This ADR proposes Backend.
