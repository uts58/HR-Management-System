/**
 * The single seam between services and AccountAdminApi
 * (ADR-0004 rule 10: auth tables are written only through web/src/auth).
 *
 * The employee service passes its Prisma transaction client as `tx`, so
 * account writes (create, disable, temporary password, display name) commit
 * or roll back with the employee change. Failures are ServiceError-shaped
 * (`name: "ServiceError"`), which `@/server/errors` maps by shape.
 * Integration tests inject their own implementation through
 * `createEmployeeService(accounts)` instead of mocking this module.
 */

import "server-only";

export { accountAdmin, setInitialPassword } from "@/auth";
