import "server-only";

import { unstable_rethrow } from "next/navigation";
import { toActionResult, type ErrorLogger } from "./errors-core";
import type { ActionResult } from "@/contracts/common";

export * from "./errors-core";

export async function runAction<T>(
  fn: () => Promise<T> | T,
  log?: ErrorLogger,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    unstable_rethrow(e);
    return toActionResult(e, log);
  }
}
