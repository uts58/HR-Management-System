"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import type { Role } from "@/contracts";

import { NAV_BY_ROLE, isActive } from "./nav-config";

export function SidebarNav({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = NAV_BY_ROLE[role];
  const all = groups.flatMap((g) => g.items);

  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {groups.map((group, index) => {
        const headingId = group.label ? `nav-group-${index}` : undefined;
        return (
          <div key={group.label ?? index} className="flex flex-col gap-1">
            {group.label && (
              <h2
                id={headingId}
                className="px-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {group.label}
              </h2>
            )}
            <ul aria-labelledby={headingId} className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item, pathname, all);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                      className={cn(
                        "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground/85 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
                        active &&
                          "bg-sidebar-accent text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-sidebar-primary" : "opacity-70",
                        )}
                        aria-hidden="true"
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
