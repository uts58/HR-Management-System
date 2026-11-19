import { UsersRoundIcon } from "lucide-react";

/** Product mark used in the sidebar, mobile sheet and auth pages. */
export function Brand() {
  return (
    <span className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <UsersRoundIcon className="size-4" aria-hidden="true" />
      </span>
      HR Management
    </span>
  );
}
