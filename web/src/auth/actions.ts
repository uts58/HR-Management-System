"use server";

import { z } from "zod";
import { changePasswordSchema } from "@/lib/validation/auth";
import { defineAction } from "@/server/action";
import {
  changePasswordForSession,
  signOutCurrentSession,
} from "./self-service";
import { loadCurrentSession } from "./session";
import { AuthError } from "./errors";

export const changePassword = defineAction({
  role: "ANY",
  allowPendingPasswordChange: true,
  schema: changePasswordSchema,
  handler: async (_actor, input) => {
    const current = await loadCurrentSession();
    if (!current) throw new AuthError("UNAUTHENTICATED");
    await changePasswordForSession(current, input);
  },
});

export const signOut = defineAction({
  role: "PUBLIC",
  schema: z.unknown(),
  handler: async () => {
    await signOutCurrentSession();
  },
});
