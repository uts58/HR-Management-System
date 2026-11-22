import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";

import { Role, requireRole } from "@/auth";
import { toActor } from "@/server/action";
import { employeeService } from "@/server/employee/service";
import { AppraisalForm } from "../appraisal-client";

export const metadata: Metadata = { title: "Add appraisal" };

/** Feature map rows 30–31 (legacy /addPerformance). HR only. */
export default async function NewAppraisalPage() {
  const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  const actor = toActor(session);
  const employees = await employeeService.listEmployeeOptions(actor);

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
