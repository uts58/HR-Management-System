import "server-only";

import type { AuthApi } from "@/contracts/auth";

export type AuthGate = Pick<AuthApi, "requireRole" | "requireSession">;

export { requireRole, requireSession } from "@/auth";
