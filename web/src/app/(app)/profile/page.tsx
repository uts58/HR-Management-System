import { KeyRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NotFoundState } from "@/components/common/not-found-state";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeDetails } from "@/components/employees/employee-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { getMyProfileStub } from "../../_stubs/services";

export const metadata: Metadata = { title: "My profile" };

/**
 * Feature map row 14 (legacy /hr/viewProfile, and HR's "View Profile").
 * Read-only for everyone (parity: nobody edits their own details).
 */
export default async function ProfilePage() {
  // TODO(Security): await requireSession({ onFail: "redirect" });
  // TODO(Backend): employeeService.getMyProfile(actor); NOT_FOUND → the
  // "no employee record" state below.
  const profile = await getMyProfileStub();

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
