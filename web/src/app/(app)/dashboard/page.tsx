import {
  BellRingIcon,
  CalendarClockIcon,
  ChevronRightIcon,
  MegaphoneIcon,
  StarIcon,
  UserPlusIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "cn";

import { requireSession } from "@/auth";
import { RECENT_NOTICE_LIMIT, type Notice } from "@/contracts";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { NoticeTypeBadge } from "@/components/common/status-badges";
import { LocalTime } from "@/components/local-time";
import { toActor } from "@/server/action";
import { leaveService } from "@/server/leave/service";
import { noticeService } from "@/server/notice/service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

/** HR and employee variants. */
export default async function DashboardPage() {
  const session = await requireSession({ onFail: "redirect" });
  const actor = toActor(session);
  const isHr = session.user.role === "HR_ADMIN";

  const [notices, leaveCount] = await Promise.all([
    noticeService.listRecentNotices(actor, RECENT_NOTICE_LIMIT),
    isHr
      ? leaveService.countPendingLeaveRequests(actor)
      : // Accounts without an employee record have no leave of their own.
        session.user.employeeId === null
        ? Promise.resolve(0)
        : leaveService.countMyUnseenDecisions(actor),
  ]);

  return (
    <>
      <PageHeader
        title={`Welcome, ${session.user.displayName}`}
        description={
          isHr
            ? "Here is what needs your attention today."
            : "Your notices and leave updates."
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {leaveCount > 0 && (
            <Link
              href={isHr ? "/leave/requests" : "/leave/history"}
              className="group flex items-center gap-3 rounded-xl border border-info/30 bg-info/10 p-4 text-sm outline-none hover:bg-info/15 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <BellRingIcon
                className="size-5 shrink-0 text-info"
                aria-hidden="true"
              />
              <span className="flex-1 font-medium">
                {isHr
                  ? `Pending leave requests (${leaveCount})`
                  : `Your leave request has been reviewed (${leaveCount})`}
              </span>
              <ChevronRightIcon
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          )}
          <RecentNotices notices={notices} />
        </div>
        <div className="flex flex-col gap-6">
          {isHr && <QuickLinks />}
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Our company policy</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              {/* Static text carried over from the legacy dashboard. */}
              The payroll module automates the pay process by gathering data on
              employee time and attendance, calculating various deductions and
              taxes, and generating periodic pay cheques and employee tax
              reports.
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function RecentNotices({ notices }: { notices: Notice[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Recent notices</h2>
        </CardTitle>
        <CardDescription>
          The {RECENT_NOTICE_LIMIT} newest notices. Select one to read it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {notices.length === 0 ? (
          <EmptyState
            icon={MegaphoneIcon}
            title="No notices yet"
            description="Company notices will appear here."
          />
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {notices.map((notice) => (
              <li key={notice.id}>
                <details
                  className={cn(
                    "group",
                    notice.type === "URGENT" &&
                      "border-l-4 border-l-destructive",
                  )}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                    <ChevronRightIcon
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 font-medium">
                      {notice.title}
                    </span>
                    <NoticeTypeBadge type={notice.type} />
                  </summary>
                  <div className="flex flex-col gap-2 px-10 pb-3 text-sm">
                    <p className="whitespace-pre-line">{notice.body}</p>
                    <p className="text-xs text-muted-foreground">
                      Posted <LocalTime value={notice.createdAt} />
                    </p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function QuickLinks() {
  const links = [
    { href: "/employees/new", label: "Add employee", icon: UserPlusIcon },
    {
      href: "/leave/requests",
      label: "Review leave requests",
      icon: CalendarClockIcon,
    },
    { href: "/notices", label: "Post a notice", icon: MegaphoneIcon },
    { href: "/appraisals/new", label: "Record an appraisal", icon: StarIcon },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Quick actions</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-9 items-center gap-2.5 rounded-lg px-2 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Icon className="size-4 text-primary" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
