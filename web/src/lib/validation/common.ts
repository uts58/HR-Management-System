/**
 * Shared Zod building blocks for the per-domain schemas (ADR-0005).
 *
 * Everything here is client-safe: schemas run in forms, in server actions
 * (authoritative) and in services (guard). Inputs may come from FormData,
 * so every field accepts strings and coerces them (`"12"` -> 12,
 * `""` -> missing / null).
 *
 * Conventions (contracts.md): strings are trimmed; empty optional strings
 * become `null`. Passwords are the exception: never trimmed.
 */

import { z } from "zod";
import type { IsoDate } from "@/contracts/common";
import { isIsoDate } from "@/lib/dates";

/** Largest value of a Postgres `integer` (all our ids). */
export const MAX_INT32 = 2_147_483_647;

/** Earliest and latest calendar dates any input may use. */
export const MIN_INPUT_DATE = "1900-01-01" as IsoDate;
export const MAX_INPUT_DATE = "2100-12-31" as IsoDate;

/** `""`, `null` and whitespace-only strings count as "not provided". */
const isBlank = (v: unknown): boolean =>
  v == null || (typeof v === "string" && v.trim() === "");

/**
 * Required trimmed string of 1..max characters.
 * `label` is used in messages: "First name is required".
 *
 * Field schemas here avoid `abort: true`: an aborting issue on any field
 * makes Zod skip object-level refinements (such as the date-order checks),
 * so those errors would only appear after this field was fixed.
 */
export function requiredText(label: string, max: number) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be at most ${max} characters` });
}

/**
 * Optional trimmed string of at most `max` characters. Missing, `null` and
 * blank all become `null`.
 */
export function optionalText(label: string, max: number) {
  return z
    .preprocess(
      (v) => (isBlank(v) ? null : v),
      z
        .string({ error: `${label} must be text` })
        .trim()
        .max(max, { error: `${label} must be at most ${max} characters` })
        .nullable(),
    )
    .optional() // the key may be omitted by callers
    .transform((v) => v ?? null);
}

/**
 * Positive integer id (Postgres `integer`). Accepts a number or a string of
 * digits (FormData, route params). Blank gives `requiredMessage`.
 */
export function idField(requiredMessage = "Id is required") {
  return z.preprocess(
    (v) => {
      if (isBlank(v)) return undefined;
      if (typeof v === "string") {
        const s = v.trim();
        return /^\d+$/.test(s) ? Number(s) : s;
      }
      return v;
    },
    z
      .number({ error: requiredMessage })
      .int({ error: requiredMessage })
      .min(1, { error: requiredMessage })
      .max(MAX_INT32, { error: requiredMessage }),
  );
}

/** A route/record id on its own, e.g. `entityIdSchema.parse(params.id)`. */
export const entityIdSchema = idField("Invalid id");

/** `{ id }` input for delete/terminate/reset style actions. */
export const idInputSchema = z.object({ id: entityIdSchema });

/**
 * Required calendar date `YYYY-MM-DD` (ADR-0007), within
 * MIN_INPUT_DATE..MAX_INPUT_DATE. Output is the branded `IsoDate`.
 */
export function isoDateField(label: string) {
  // Each check guards itself instead of using `abort: true` (see
  // requiredText), so a field reports exactly one error.
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required` })
    .refine((v) => v === "" || isIsoDate(v), {
      error: `${label} must be a valid date (YYYY-MM-DD)`,
    })
    .refine(
      (v) => !isIsoDate(v) || (v >= MIN_INPUT_DATE && v <= MAX_INPUT_DATE),
      { error: `${label} must be between 1900 and 2100` },
    )
    .transform((v) => v as IsoDate);
}

/**
 * `z.enum` over a contract `as const` tuple, with one friendly message for
 * a missing or unknown value.
 */
export function enumField<const T extends readonly [string, ...string[]]>(
  values: T,
  message: string,
) {
  return z.enum(values, { error: message });
}

/**
 * `when` option for an object-level `.refine` that compares some fields
 * (e.g. end date >= start date). Zod skips object refinements once any
 * field has failed, so date-order errors would only appear after every
 * other field was fixed. This runs the check whenever the fields it reads
 * parsed cleanly, so all errors show at once.
 */
export function whenFieldsValid(...keys: string[]) {
  return (payload: z.core.ParsePayload): boolean =>
    !payload.issues.some((issue) => keys.includes(String(issue.path?.[0])));
}

/**
 * For actions that take no input (e.g. sign out). Ignores whatever is
 * passed and produces `undefined`.
 */
export const noInputSchema = z.unknown().transform((): undefined => undefined);
