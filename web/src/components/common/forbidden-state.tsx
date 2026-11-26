import { ShieldXIcon } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";

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
      <ButtonLink href={backHref}>{backLabel}</ButtonLink>
    </div>
  );
}
