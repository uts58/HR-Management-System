"use client";

import { CheckIcon, CopyIcon, KeyRoundIcon } from "lucide-react";
import { useState } from "react";

import type { IssuedCredentials } from "@/contracts";
import { Button } from "@/components/ui/button";

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="flex items-center gap-2">
        <code className="min-w-0 flex-1 rounded-md border bg-muted px-2.5 py-1.5 font-mono text-sm break-all select-all">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={
            copied ? `${label} copied` : `Copy ${label.toLowerCase()}`
          }
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard can be blocked (insecure origin, permissions).
              // The value stays selectable, so the user can copy by hand.
            }
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </dd>
    </div>
  );
}

/**
 * One-time credentials after "create employee" or "reset password"
 * (contracts.md Employee rule 2). Lives only in client state: it is never
 * written to the URL or storage, and a reload loses it on purpose.
 */
export function CredentialsPanel({
  credentials,
  heading = "Temporary login",
}: {
  credentials: IssuedCredentials;
  heading?: string;
}) {
  return (
    <section
      aria-label={heading}
      className="flex flex-col gap-4 rounded-xl border border-warning/40 bg-warning/5 p-4"
    >
      <div className="flex items-start gap-3">
        <KeyRoundIcon
          className="mt-0.5 size-5 shrink-0 text-warning"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1">
          <h2 className="font-heading font-semibold">{heading}</h2>
          <p className="text-sm text-muted-foreground">
            This password is shown <strong>only once</strong>. Give it to the
            employee securely; they must choose a new password when they first
            sign in.
          </p>
        </div>
      </div>
      <dl className="flex flex-col gap-3">
        <CopyValue label="Username" value={credentials.username} />
        <CopyValue
          label="Temporary password"
          value={credentials.temporaryPassword}
        />
      </dl>
    </section>
  );
}
