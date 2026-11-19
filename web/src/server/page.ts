/**
 * Helpers for Server Components (ADR-0006 rule 5): pages let errors bubble,
 * except NOT_FOUND, which becomes Next's notFound() (the route's
 * not-found page).
 *
 *   const employee = await orNotFound(
 *     employeeService.getEmployee(actor, idOrNotFound(params.id)),
 *   );
 */

import "server-only";

import { notFound } from "next/navigation";
import { entityIdSchema } from "@/lib/validation/common";
import { isServiceError } from "./errors";

/**
 * Await a service call; a ServiceError NOT_FOUND calls `notFound()`.
 * Every other error is rethrown for the route's error.tsx.
 */
export async function orNotFound<T>(
  call: Promise<T> | (() => Promise<T>),
): Promise<T> {
  try {
    return await (typeof call === "function" ? call() : call);
  } catch (e) {
    if (isServiceError(e) && e.code === "NOT_FOUND") notFound();
    throw e;
  }
}

/** A route param as a record id; anything malformed is a 404, not a 500. */
export function idOrNotFound(raw: unknown): number {
  const parsed = entityIdSchema.safeParse(raw);
  if (!parsed.success) notFound();
  return parsed.data;
}
