"use client";

import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

/**
 * Unexpected error inside the shell (ADR-0006 rule 5). Shows a generic
 * message plus the digest so support can match the server log; never the
 * raw error text. Focus moves to the heading so screen readers announce it.
 */
export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const digest =
    error instanceof Error && "digest" in error
      ? String((error as Error & { digest?: string }).digest ?? "")
      : "";

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlertIcon className="size-6" aria-hidden="true" />
      </span>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-heading text-xl font-semibold outline-none"
      >
        Something went wrong
      </h1>
      <p className="text-sm text-muted-foreground">
        The page could not be loaded. Please try again. If the problem
        continues, contact your administrator
        {digest ? (
          <>
            {" "}
            and quote reference <code className="font-mono">{digest}</code>
          </>
        ) : null}
        .
      </p>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Button variant="outline" render={<Link href="/dashboard" />}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
