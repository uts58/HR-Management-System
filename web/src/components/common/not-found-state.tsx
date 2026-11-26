import { SearchXIcon } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";

export function NotFoundState({
  title = "Page not found",
  description = "The page or record you are looking for does not exist, or you do not have access to it.",
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
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchXIcon className="size-6" aria-hidden="true" />
      </span>
      <h1 className="font-heading text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <ButtonLink href={backHref}>{backLabel}</ButtonLink>
    </div>
  );
}
