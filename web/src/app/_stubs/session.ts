/**
 * STUB SESSION (Phase 1a). Stands in for Security's getSession /
 * requireSession / requireRole from "@/auth" until they exist.
 *
 * The persona comes from the `hr-stub-persona` cookie, set by the
 * persona switcher in the header (./persona-switcher.tsx), so both role
 * variants and the forced password change can be reviewed without a
 * database. Remove together with the rest of app/_stubs.
 */

import { cookies } from "next/headers";

import type { Session } from "@/contracts";

export const STUB_PERSONA_COOKIE = "hr-stub-persona";

export const STUB_PERSONAS = ["hr", "employee", "must-change"] as const;
export type StubPersona = (typeof STUB_PERSONAS)[number];

const sessions: Record<StubPersona, Session> = {
  hr: {
    user: {
      userId: "stub-user-1",
      employeeId: 1,
      username: "admin",
      displayName: "Amina Rahman",
      role: "HR_ADMIN",
      mustChangePassword: false,
    },
    expires: "2026-11-24T00:00:00.000Z",
  },
  employee: {
    user: {
      userId: "stub-user-2",
      employeeId: 2,
      username: "rafiq",
      displayName: "Rafiq Chowdhury",
      role: "EMPLOYEE",
      mustChangePassword: false,
    },
    expires: "2026-11-24T00:00:00.000Z",
  },
  "must-change": {
    user: {
      userId: "stub-user-3",
      employeeId: 3,
      username: "priya",
      displayName: "Priya Sharma",
      role: "EMPLOYEE",
      mustChangePassword: true,
    },
    expires: "2026-11-24T00:00:00.000Z",
  },
};

export async function getStubPersona(): Promise<StubPersona> {
  const value = (await cookies()).get(STUB_PERSONA_COOKIE)?.value;
  return STUB_PERSONAS.find((p) => p === value) ?? "hr";
}

/**
 * → requireSession({ onFail: "redirect" }) / requireRole(...) from "@/auth".
 * Never returns null: the stub has no anonymous state.
 */
export async function getSessionStub(): Promise<Session> {
  return sessions[await getStubPersona()];
}
