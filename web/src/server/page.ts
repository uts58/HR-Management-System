import "server-only";

import { notFound } from "next/navigation";
import { entityIdSchema } from "@/lib/validation/common";
import { isServiceError } from "./errors";

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

export function idOrNotFound(raw: unknown): number {
  const parsed = entityIdSchema.safeParse(raw);
  if (!parsed.success) notFound();
  return parsed.data;
}
