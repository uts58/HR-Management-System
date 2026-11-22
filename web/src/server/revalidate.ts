/**
 * Cache invalidation after a mutation. The server actions live in
 * server/<domain>/actions.ts and don't know the route paths, so they
 * revalidate the whole app layout. Every page here is per-user and dynamic,
 * so this only refreshes the client router cache; it costs nothing extra.
 * If Frontend wants narrower paths, this is the single place to change.
 */

import "server-only";

import { revalidatePath } from "next/cache";

export function revalidateApp(): void {
  revalidatePath("/", "layout");
}
