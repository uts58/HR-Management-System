import {
  BriefcaseBusinessIcon,
  Building2Icon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  ClipboardListIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  StarIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/contracts";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Extra path prefixes that should also highlight this item. */
  match?: string[];
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const dashboard: NavGroup = {
  label: null,
  items: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  ],
};

/**
 * Navigation per role, from docs/architecture/feature-map.md ("Navigation").
 * Hiding a link is convenience only; pages and actions enforce access.
 * Profile, Change password and Sign out live in the user menu.
 */
export const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  HR_ADMIN: [
    dashboard,
    {
      label: "Employees",
      items: [
        {
          label: "Manage employees",
          href: "/employees",
          icon: UsersIcon,
          match: ["/employees/"],
        },
        { label: "Add employee", href: "/employees/new", icon: UserPlusIcon },
        { label: "Departments", href: "/org/departments", icon: Building2Icon },
        {
          label: "Positions",
          href: "/org/positions",
          icon: BriefcaseBusinessIcon,
        },
      ],
    },
    {
      label: "Notices",
      items: [
        { label: "Manage notices", href: "/notices", icon: MegaphoneIcon },
      ],
    },
    {
      label: "Leave",
      items: [
        {
          label: "Pending requests",
          href: "/leave/requests",
          icon: CalendarClockIcon,
        },
        { label: "All leave", href: "/leave/all", icon: CalendarCheckIcon },
      ],
    },
    {
      label: "Appraisals",
      items: [
        { label: "Manage appraisals", href: "/appraisals", icon: StarIcon },
        {
          label: "Add appraisal",
          href: "/appraisals/new",
          icon: ClipboardListIcon,
        },
      ],
    },
  ],
  EMPLOYEE: [
    dashboard,
    {
      label: "Leave",
      items: [
        {
          label: "Apply for leave",
          href: "/leave/apply",
          icon: CalendarPlusIcon,
        },
        { label: "Leave history", href: "/leave/history", icon: HistoryIcon },
      ],
    },
  ],
};

/** Is `item` the current page? Exact match, or one of its `match` prefixes. */
export function isActive(item: NavItem, pathname: string, all: NavItem[]) {
  if (pathname === item.href) return true;
  // A more specific item (e.g. /employees/new) wins over a prefix match.
  if (all.some((other) => other !== item && other.href === pathname)) {
    return false;
  }
  return item.match?.some((prefix) => pathname.startsWith(prefix)) ?? false;
}
