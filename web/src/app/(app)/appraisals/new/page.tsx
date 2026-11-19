import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";

import { listEmployeeOptionsStub } from "../../../_stubs/services";
import { AppraisalForm } from "../appraisal-client";

export const metadata: Metadata = { title: "Add appraisal" };

/** Feature map rows 30–31 (legacy /addPerformance). HR only. */
export default async function NewAppraisalPage() {
  // TODO(Security): await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  // TODO(Backend): employeeService.listEmployeeOptions(actor)
  const employees = await listEmployeeOptionsStub();

  return (
    <>
      <PageHeader
        title="Add appraisal"
        breadcrumbs={[
          { label: "Appraisals", href: "/appraisals" },
          { label: "Add appraisal" },
        ]}
      />
      <Card className="max-w-3xl">
        <CardContent>
          <AppraisalForm employees={employees} />
        </CardContent>
      </Card>
    </>
  );
}
