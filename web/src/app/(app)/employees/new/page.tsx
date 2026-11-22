import type { Metadata } from "next";

import { Role, requireRole } from "@/auth";
import { toActor } from "@/server/action";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { employeeService } from "@/server/employee/service";

import { EmployeeForm } from "../_components/employee-form";

export const metadata: Metadata = { title: "Add employee" };

/** Feature map rows 8–9 (legacy /hr/addEmployee, /hr/saveEmp). HR only. */
export default async function NewEmployeePage() {
  const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  const actor = toActor(session);
  const options = await employeeService.getEmployeeFormOptions(actor);

  return (
    <>
      <PageHeader
        title="Add employee"
        description="Creates the employee record and a login account. The employee ID is assigned automatically."
        breadcrumbs={[
          { label: "Employees", href: "/employees" },
          { label: "Add employee" },
        ]}
      />
      <Card>
        <CardContent>
          <EmployeeForm mode="create" options={options} />
        </CardContent>
      </Card>
    </>
  );
}
