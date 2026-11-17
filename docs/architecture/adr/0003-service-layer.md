# ADR-0003: Service layer

- Status: Accepted
- Date: 2026-11-17

## Context

Legacy route handlers mix session checks, parsing, Prisma calls and rendering. Nothing can be tested in isolation, and the same queries (e.g. "employee name for an id") are copied into several handlers and templates.

## Decision

1. **Services own all data access.** Business logic and every Prisma call live in `web/src/server/<domain>/service.ts`. Each service implements the matching interface in `web/src/contracts/<domain>.ts` (e.g. `export const leaveService: LeaveService = {...}`).
2. **No Prisma outside `web/src/server/` and `web/prisma/`.** Components, pages and actions never import the Prisma client or Prisma types. Services return contract DTOs (plain objects, no Prisma models). That way no extra columns, such as password hashes, can leak to the client.
3. **Services take an `Actor` first.** `fn(actor: Actor, ...args)`. The action builds `actor` from the session that `requireRole()` returns. Services:
   - never read cookies, headers or call `getSession()`;
   - **check the role again and enforce ownership themselves** (defence in depth), e.g. `getEmployee` gives an EMPLOYEE only their own record. The action's `requireRole` is the first gate, the service is the second.
4. **Services throw, actions return.** Services throw `ServiceError` (ADR-0006). Actions catch it and return `ActionResult`.
5. **Services validate their own input** with the same Zod schema the action used (`schema.parse`). It is cheap, and services stay safe when called from somewhere other than an action (scripts, tests).
6. **Transactions** live inside a single service function (`prisma.$transaction`). A service may call another domain's service function, but must not open a second transaction around it.
7. **Pages read through services as well.** Server Components call `requireRole(..., { onFail: 'redirect' })` and then the service. They do not query the database directly.

Typical action:

```ts
'use server';
export async function decideLeave(id: number, decision: LeaveDecision): Promise<ActionResult> {
  return runAction(async () => {                                  // server/errors.ts helper
    const session = await requireRole(Role.HR_ADMIN);             // auth
    const input = decideLeaveSchema.parse({ id, decision });      // validation
    await leaveService.decideLeaveRequest(toActor(session), input.id, input.decision);
    revalidatePath('/leave/requests');
  });
}
```

## Consequences

- Services can be unit tested against a test database with no Next.js runtime (ADR-0008).
- There is a little boilerplate per action. `runAction` and `toActor` (Backend) keep it small.
- Contract changes need a PR to `web/src/contracts` (Tech Lead review).
