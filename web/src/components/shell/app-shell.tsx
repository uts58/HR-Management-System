import Link from "next/link";
import type { ReactNode } from "react";

import type { SessionUser } from "@/contracts";

import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

/**
 * Authenticated layout: skip link, role-based sidebar (a sheet below md),
 * sticky top bar with the user menu, and a single <main> landmark.
 *
 * `restricted` is for users with mustChangePassword: no navigation, only
 * Sign out, because every other page redirects to /change-password anyway.
 */
export function AppShell({
  user,
  restricted = false,
  signOutAction,
  headerExtra,
  children,
}: {
  user: Pick<SessionUser, "displayName" | "username" | "role">;
  restricted?: boolean;
  signOutAction?: () => Promise<unknown>;
  /** Optional slot at the start of the header's right side. */
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh w-full">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>

      {!restricted && (
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
          <div className="flex h-14 items-center border-b px-4">
            <Link
              href="/dashboard"
              className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Brand />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-4">
            <SidebarNav role={user.role} />
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-2 backdrop-blur supports-backdrop-filter:bg-background/75 sm:px-4">
          {!restricted && <MobileNav role={user.role} />}
          <div className={restricted ? "flex" : "flex md:hidden"}>
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {headerExtra}
            <UserMenu
              user={user}
              restricted={restricted}
              signOutAction={signOutAction}
            />
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
