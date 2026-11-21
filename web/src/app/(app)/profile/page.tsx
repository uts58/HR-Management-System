import { KeyRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { requireSession } from "@/auth";
import { NotFoundState } from "@/components/common/not-found-state";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeDetails } from "@/components/employees/employee-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toActor } from "@/server/action";
import { employeeService } from "@/server/employee/service";
import { isServiceError } from "@/server/errors";

export const metadata: Metadata = { title: "My profile" };

/**
 * Feature map row 14 (legacy /hr/viewProfile, and HR's "View Profile").
 * Read-only for everyone (parity: nobody edits their own details).
 */
export default async function ProfilePage() {
  const session = await requireSession({ onFail: "redirect" });
  // NOT_FOUND means the account has no employee record: show the
  // explanation below instead of a generic 404.
  const profile = await employeeService
    .getMyProfile(toActor(session))
    .catch((e: unknown) => {
      if (isServiceError(e) && e.code === "NOT_FOUND") return null;
      throw e;
    });

  if (!profile) {
    return (
      <NotFoundState
        title="No employee record"
        description="Your account isn't linked to an employee record. Contact HR if this is unexpected."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="My profile"
        description="Contact HR to correct any of these details."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My profile" },
        ]}
        actions={
          <Button variant="outline" render={<Link href="/change-password" />}>
            <KeyRoundIcon aria-hidden="true" />
            Change password
          </Button>
        }
      />
      <Card>
        <CardContent>
          <EmployeeDetails employee={profile} />
        </CardContent>
      </Card>
    </>
  );
}
