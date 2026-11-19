import type { Metadata } from "next";

import { listDepartmentsStub } from "../../../_stubs/services";
import { OrgUnitPage } from "../_components/org-unit-page";

export const metadata: Metadata = { title: "Departments" };

/** Feature map rows 15–17 (legacy /hr/addDep). HR only. */
export default async function DepartmentsPage() {
  // TODO(Security): await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  // TODO(Backend): orgService.listDepartments(actor)
  const departments = await listDepartmentsStub();
  return <OrgUnitPage kind="department" rows={departments} />;
}
