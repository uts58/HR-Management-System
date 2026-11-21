"use client";

import { useRouter } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/form-field";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  changePasswordSchema,
} from "@/lib/validation";

import { stubFormAction } from "../../_stubs/actions";

// TODO(Security): replace with `changePassword` from "@/auth/actions"
// (defineAction role "ANY", allowPendingPasswordChange: true).
const changePasswordAction = stubFormAction("changePassword");

/**
 * Change password (feature map rows 5–6). Fields = ChangePasswordInput.
 * Errors land on the right field: wrong current password → currentPassword,
 * mismatch → confirmPassword, policy → newPassword.
 */
export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  return (
    <ActionForm
      aria-label="Change password"
      action={changePasswordAction}
      schema={changePasswordSchema}
      successMessage={
        forced
          ? undefined
          : "Password changed. Your other sessions were signed out."
      }
      resetOnSuccess
      onSuccess={() => {
        if (forced) router.replace("/dashboard");
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
