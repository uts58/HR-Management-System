/**
 * Auth form schemas (contracts.md#auth). Security owns the auth flows and
 * may tighten the password policy; these are the shared form shapes.
 *
 * Passwords are never trimmed or lower-cased.
 *
 * - `signInSchema` only checks that both fields are present, so the form
 *   gives no hint about which accounts exist. The username is trimmed and
 *   lower-cased (logins are case-insensitive).
 * - `changePasswordSchema` encodes the policy rules that need no database:
 *   8..128 characters, confirmation matches, differs from the current
 *   password. "Not equal to the username" and "current password correct"
 *   are checked by Security's changePassword action.
 */

import { z } from "zod";
import type { ChangePasswordInput, SignInInput } from "@/contracts/auth";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const INVALID_LOGIN = "Invalid username or password";

const requiredSecret = (message: string) =>
  z.string({ error: message }).min(1, { error: message });

export const signInSchema = z.object({
  username: z
    .string({ error: "Please enter the username" })
    .trim()
    .toLowerCase()
    .min(1, { error: "Please enter the username", abort: true })
    .max(100, { error: INVALID_LOGIN }),
  password: requiredSecret("Please enter the password").max(PASSWORD_MAX, {
    error: INVALID_LOGIN,
  }),
}) satisfies z.ZodType<SignInInput>;

export const newPasswordField = z
  .string({ error: "New password is required" })
  .min(1, { error: "New password is required", abort: true })
  .min(PASSWORD_MIN, {
    error: `New password must be at least ${PASSWORD_MIN} characters`,
  })
  .max(PASSWORD_MAX, {
    error: `New password must be at most ${PASSWORD_MAX} characters`,
  });

export const changePasswordSchema = z
  .object({
    currentPassword: requiredSecret("Current password is required").max(
      PASSWORD_MAX,
      { error: "Current password is incorrect" },
    ),
    newPassword: newPasswordField,
    confirmPassword: requiredSecret("Please confirm the new password"),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword !== v.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
    if (v.newPassword === v.currentPassword) {
      ctx.addIssue({
        code: "custom",
        message: "New password must be different from the current password",
        path: ["newPassword"],
      });
    }
  }) satisfies z.ZodType<ChangePasswordInput>;
