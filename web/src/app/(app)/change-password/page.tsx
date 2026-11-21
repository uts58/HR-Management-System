import { ShieldAlertIcon } from "lucide-react";
import type { Metadata } from "next";

import { requireSession } from "@/auth";
import { PageHeader } from "@/components/common/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";

import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Change password" };

/**
 * Feature map rows 5–6. Also the forced page while mustChangePassword is
 * set: requireSession/requireRole send every other page here, and the shell
 * hides the navigation.
 */
export default async function ChangePasswordPage() {
  const session = await requireSession({
    onFail: "redirect",
    allowPendingPasswordChange: true,
  });
  const forced = session.user.mustChangePassword;

  return (
    <div className="mx-auto w-full max-w-lg">
      <PageHeader
        title={forced ? "Choose a new password" : "Change password"}
        breadcrumbs={
          forced
            ? undefined
            : [
                { label: "Dashboard", href: "/dashboard" },
                { label: "Change password" },
              ]
        }
        description={
          forced
            ? undefined
            : "Changing your password signs you out on your other devices."
        }
      />
      {forced && (
        <Alert className="mb-6 border-warning/40 bg-warning/5">
          <ShieldAlertIcon aria-hidden="true" className="text-warning" />
          <AlertTitle>You need to change your password to continue</AlertTitle>
          <AlertDescription>
            Your account has a temporary password. Choose a new one before using
            the HR system.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent>
          <ChangePasswordForm forced={forced} />
        </CardContent>
      </Card>
    </div>
  );
}
