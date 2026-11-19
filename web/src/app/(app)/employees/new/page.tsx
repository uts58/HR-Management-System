import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";

import { getEmployeeFormOptionsStub } from "../../../_stubs/services";
import { EmployeeForm } from "../_components/employee-form";

export const metadata: Metadata = { title: "Add employee" };

/** Feature map rows 8–9 (legacy /hr/addEmployee, /hr/saveEmp). HR only. */
export default async function NewEmployeePage() {
  // TODO(Security): await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  // TODO(Backend): employeeService.getEmployeeFormOptions(actor)
  const options = await getEmployeeFormOptionsStub();

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
