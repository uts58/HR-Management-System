"use client";

import { CircleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { signInWithUsername } from "@/auth/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Sign-in form. Calls `signInWithUsername` from the browser
 * (POST /api/auth/sign-in/username, deliberately not a server action, so
 * Better Auth's rate limiter applies). The failure message is always
 * generic, or the rate-limit message.
 */
export function LoginForm({ callbackUrl }: { callbackUrl: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const alertRef = useRef<HTMLDivElement>(null);

  return (
    <form
      aria-label="Sign in"
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const input = {
          username: String(form.get("username") ?? ""),
          password: String(form.get("password") ?? ""),
        };
        startTransition(async () => {
          const result = await signInWithUsername(input, callbackUrl);
          if (result.ok) {
            router.replace(result.data.redirectTo);
            router.refresh();
            return;
          }
          setError(result.error.message);
          requestAnimationFrame(() => alertRef.current?.focus());
        });
      }}
    >
      {error && (
        <Alert variant="destructive" ref={alertRef} tabIndex={-1}>
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            className="h-10"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-10"
          />
        </Field>
      </FieldGroup>
      <Button
        type="submit"
        size="lg"
        className="h-10 w-full"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
