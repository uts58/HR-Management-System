import { z } from "zod";
import type { IsoDate } from "@/contracts/common";
import { isIsoDate } from "@/lib/dates";

export const MAX_INT32 = 2_147_483_647;

export const MIN_INPUT_DATE = "1900-01-01" as IsoDate;
export const MAX_INPUT_DATE = "2100-12-31" as IsoDate;

const isBlank = (v: unknown): boolean =>
  v == null || (typeof v === "string" && v.trim() === "");

export function requiredText(label: string, max: number) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be at most ${max} characters` });
}

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
    .optional()
    .transform((v) => v ?? null);
}

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

export const entityIdSchema = idField("Invalid id");

export const idInputSchema = z.object({ id: entityIdSchema });

export function isoDateField(label: string) {
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

export function optionalIsoDateField(label: string) {
  return z
    .preprocess(
      (v) => (isBlank(v) ? null : v),
      isoDateField(label).nullable(),
    )
    .optional()
    .transform((v) => v ?? null);
}

export function optionalEnumField<
  const T extends readonly [string, ...string[]],
>(values: T, message: string) {
  return z
    .preprocess(
      (v) => (isBlank(v) ? null : v),
      z.enum(values, { error: message }).nullable(),
    )
    .optional()
    .transform((v) => v ?? null);
}

export function enumField<const T extends readonly [string, ...string[]]>(
  values: T,
  message: string,
) {
  return z.enum(values, { error: message });
}

export function whenFieldsValid(...keys: string[]) {
  return (payload: z.core.ParsePayload): boolean =>
    !payload.issues.some((issue) => keys.includes(String(issue.path?.[0])));
}

export const noInputSchema = z.unknown().transform((): undefined => undefined);
