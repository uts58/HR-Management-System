import { ShieldXIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * "You don't have access" body (403). Used by the /forbidden page and by any
 * page that renders it in place when requireRole fails (Security decides
 * which, director ruling). Deliberately says nothing about whether the
 * record exists.
 */
export function ForbiddenState({
  title = "You don't have access to this page",
  description = "Your account doesn't have permission to view this page. If you think this is a mistake, contact your HR administrator.",
  backHref = "/dashboard",
  backLabel = "Go to dashboard",
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldXIcon className="size-6" aria-hidden="true" />
      </span>
      <h1 className="font-heading text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button render={<Link href={backHref} />}>{backLabel}</Button>
    </div>
  );
}
