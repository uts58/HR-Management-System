"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { changePassword } from "@/auth/actions";
import { DASHBOARD_PATH } from "@/auth/paths";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/form-field";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  changePasswordSchema,
} from "@/lib/validation";

export function ChangePasswordForm({
  forced: forcedProp,
}: {
  forced: boolean;
}) {
  const router = useRouter();
  const [forced] = useState(forcedProp);
  return (
    <ActionForm
      aria-label="Change password"
      action={changePassword}
      schema={changePasswordSchema}
      successMessage={
        forced
          ? undefined
          : "Password changed. Your other sessions were signed out."
      }
      resetOnSuccess
      onSuccess={() => {
        if (forced) {
          router.replace(DASHBOARD_PATH);
          router.refresh();
        }
      }}
    >
      <TextField
        name="currentPassword"
        label={forced ? "Temporary or current password" : "Current password"}
        type="password"
        required
        autoComplete="current-password"
      />
      <TextField
        name="newPassword"
        label="New password"
        type="password"
        required
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        autoComplete="new-password"
        description={`At least ${PASSWORD_MIN} characters. Must differ from your username and current password.`}
      />
      <TextField
        name="confirmPassword"
        label="Confirm new password"
        type="password"
        required
        maxLength={PASSWORD_MAX}
        autoComplete="new-password"
      />
      <div>
        <SubmitButton pendingLabel="Changing…">Change password</SubmitButton>
      </div>
    </ActionForm>
  );
}
