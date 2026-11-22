import "server-only";

import { headers } from "next/headers";
import { NONCE_HEADER } from "./security-headers";

/**
 * The CSP nonce proxy.ts generated for this request, for hand-written
 * inline scripts (e.g. the root layout's theme script):
 *
 *   <script nonce={await getCspNonce()} dangerouslySetInnerHTML={…} />
 *
 * Reading request headers also makes the page dynamic, which nonces need
 * (a prerendered page can't carry a per-request nonce).
 */
export async function getCspNonce(): Promise<string | undefined> {
  return (await headers()).get(NONCE_HEADER) ?? undefined;
}
