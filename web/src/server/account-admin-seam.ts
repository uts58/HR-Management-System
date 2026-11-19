/**
 * The single seam between Backend services and Security's AccountAdminApi
 * (ADR-0004 rule 10: auth tables are written only through web/src/auth).
 *
 * Security has not merged web/src/auth yet, so this holds a FAIL-CLOSED
 * placeholder: every call throws, so createEmployee, terminateEmployee and
 * resetEmployeePassword roll back their transaction and the action returns
 * INTERNAL. Nothing is half-written.
 *
 * When web/src/auth lands, replace everything below the imports with:
 *
 *   export { accountAdmin } from "@/auth";
 *
 * (or whatever name Security exports that satisfies `AccountAdminApi`).
 * The employee service receives the Prisma transaction client as `tx` and
 * passes it through, so account writes join the employee transaction.
 * Expected behaviour (contract `AccountAdminApi`):
 * - createLoginAccount(tx, input): ServiceError CONFLICT on field
 *   `username` if taken (a raw P2002 on users_username_key is also mapped);
 * - issueTemporaryPassword(tx, userId): creates the credential account if
 *   missing, revokes sessions;
 * - disableLogin(tx, userId): sets users.disabled_at, deletes sessions.
 */

import "server-only";

import type { AccountAdminApi } from "@/contracts/auth";

class AccountAdminNotConfiguredError extends Error {
  override readonly name = "AccountAdminNotConfiguredError";
  constructor() {
    super("AccountAdminApi is not configured yet (web/src/auth pending).");
  }
}

export const accountAdmin: AccountAdminApi = {
  async createLoginAccount() {
    throw new AccountAdminNotConfiguredError();
  },
  async issueTemporaryPassword() {
    throw new AccountAdminNotConfiguredError();
  },
  async disableLogin() {
    throw new AccountAdminNotConfiguredError();
  },
};
