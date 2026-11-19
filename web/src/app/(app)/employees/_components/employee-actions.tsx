"use client";

import { KeyRoundIcon, UserXIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { IssuedCredentials } from "@/contracts";
import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { CredentialsPanel } from "@/components/common/credentials-panel";
import { Button } from "@/components/ui/button";

import {
  resetEmployeePasswordStub,
  stubCommand,
} from "../../../_stubs/actions";

/**
 * Terminate (soft delete) with confirmation (feature map row 13).
 * TODO(Frontend+Backend): call terminateEmployee from ../actions.ts.
 */
export function TerminateEmployeeButton({
  employeeId,
  name,
  compact = false,
}: {
  employeeId: number;
  name: string;
  compact?: boolean;
}) {
  const router = useRouter();
  return (
    <ConfirmActionDialog
      triggerLabel="Terminate"
      triggerAriaLabel={`Terminate ${name}`}
      triggerIcon={compact ? undefined : <UserXIcon aria-hidden="true" />}
      triggerVariant="destructive"
      triggerSize={compact ? "sm" : "default"}
      title={`Terminate ${name}?`}
      description={
        <div className="flex flex-col gap-2 text-left">
          <p>This cannot be undone. Terminating this employee will:</p>
          <ul className="ml-4 list-disc">
            <li>block their sign-in and end their open sessions,</li>
            <li>reject their pending leave requests,</li>
            <li>hide them from the default employee list.</li>
          </ul>
          <p>Their leave and appraisal history is kept.</p>
        </div>
      }
      confirmLabel="Terminate employee"
      pendingLabel="Terminating…"
      destructive
      onConfirm={() => {
        void employeeId;
        return stubCommand("terminateEmployee");
      }}
      onSuccess={() => router.refresh()}
    />
  );
}

/**
 * Reset password (feature map, [NEW] approved). Shows the one-time
 * temporary password after confirmation.
 * TODO(Frontend+Backend): call resetEmployeePassword from ../actions.ts.
 */
export function ResetPasswordButton({
  employeeId,
  name,
}: {
  employeeId: number;
  name: string;
}) {
  const [credentials, setCredentials] = useState<IssuedCredentials | null>(
    null,
  );

  if (credentials) {
    return (
      <div className="flex w-full flex-col gap-3">
        <CredentialsPanel
          credentials={credentials}
          heading="New temporary password"
        />
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setCredentials(null)}
        >
          Done, hide password
        </Button>
      </div>
    );
  }

  return (
    <ConfirmActionDialog
      triggerLabel="Reset password"
      triggerIcon={<KeyRoundIcon aria-hidden="true" />}
      triggerSize="default"
      title={`Reset password for ${name}?`}
      description="A new temporary password is generated and shown once. Their current password stops working, all their sessions are signed out, and they must choose a new password at next sign-in."
      confirmLabel="Reset password"
      pendingLabel="Resetting…"
      onConfirm={() => resetEmployeePasswordStub(employeeId)}
      onSuccess={setCredentials}
    />
  );
}
