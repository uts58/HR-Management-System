# ADR-0005: Validation with shared Zod schemas

- Status: Accepted
- Date: 2026-11-17

## Context

Legacy validation exists only in browser JavaScript (`verify_addemp`, `verify`), and part of it is broken. `verify_addemp` reads a missing `inpFile` field and throws, so the form submits anyway. The server trusts the body completely (`parseInt(type) || 0`, free-text dates, unchecked rating). The add/edit employee forms also post `multipart/form-data` while only urlencoded/JSON parsers are installed, so the server most likely receives an empty body (QA to confirm).

## Decision

1. Zod 4 schemas live in `web/src/lib/validation/<domain>.ts` (Backend). One schema per contract input, named `<inputName>Schema`, e.g. `createEmployeeSchema`.
2. **Schemas are tied to contracts at compile time:**
   ```ts
   export const applyForLeaveSchema = z.object({...}) satisfies z.ZodType<ApplyForLeaveInput>;
   ```
   If a contract input type changes, the schema stops compiling.
3. The **same schema** runs:
   - in the client form (shadcn `Form` + `react-hook-form` with `zodResolver`, or plain `useActionState`, Frontend's choice) for instant feedback;
   - in the server action (`safeParse` on FormData-derived data) as the authoritative check;
   - in the service (`parse`) as a guard (ADR-0003).
4. Enum values come from the `as const` tuples in contracts (e.g. `z.enum(LEAVE_TYPES)` for new leave requests), so UI selects, schemas and types never drift.
5. FormData coercion (strings to numbers, empty string to null) happens inside the schema (`z.coerce.number()`, preprocess `'' -> null`). Forms post field names equal to contract property names (`firstName`, not `txtFirst`).
6. Cross-field rules (end ≥ start, newPassword === confirmPassword) use `.refine`/`.superRefine` with `path` set to the field that gets the error.
7. Rules that need the database (unique name, department exists) are checked in the service and thrown as `ServiceError('VALIDATION'|'CONFLICT', fieldErrors)`, so they show up in the form the same way.
8. Error messages are written for end users, in English, in the schema.

## Consequences

- Validation lives in one place, and the client/server versions cannot disagree.
- Schemas must not import server-only code, because they ship to the browser.
