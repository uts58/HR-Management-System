import type { Metadata } from "next";

import { Role, requireRole } from "@/auth";
import { toActor } from "@/server/action";
import { orgService } from "@/server/org/service";
import { OrgUnitPage } from "../_components/org-unit-page";

export const metadata: Metadata = { title: "Departments" };

/** HR only. */
export default async function DepartmentsPage() {
  const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  const actor = toActor(session);
  const departments = await orgService.listDepartments(actor);
  return <OrgUnitPage kind="department" rows={departments} />;
}
