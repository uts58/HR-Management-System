import "server-only";

import { headers } from "next/headers";
import { NONCE_HEADER } from "./security-headers";

export async function getCspNonce(): Promise<string | undefined> {
  return (await headers()).get(NONCE_HEADER) ?? undefined;
}
