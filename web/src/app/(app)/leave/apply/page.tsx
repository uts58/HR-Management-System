import type { Metadata } from "next";

import { Role, requireRole } from "@/auth";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";

import { ApplyLeaveForm } from "../_components/leave-client";

export const metadata: Metadata = { title: "Apply for leave" };

/** Feature map row 24 (legacy /addLeave). EMPLOYEE only. */
export default async function ApplyLeavePage() {
  await requireRole(Role.EMPLOYEE, { onFail: "redirect" });
  return (
    <>
      <PageHeader
        title="Apply for leave"
        description="Your request goes to HR for approval. You'll see the decision on your dashboard."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Apply for leave" },
        ]}
      />
      <Card className="max-w-2xl">
        <CardContent>
          <ApplyLeaveForm />
        </CardContent>
      </Card>
    </>
  );
}
