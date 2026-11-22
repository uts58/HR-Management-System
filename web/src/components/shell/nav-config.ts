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

export function isActive(item: NavItem, pathname: string, all: NavItem[]) {
  if (pathname === item.href) return true;
  if (all.some((other) => other !== item && other.href === pathname)) {
    return false;
  }
  return item.match?.some((prefix) => pathname.startsWith(prefix)) ?? false;
}
