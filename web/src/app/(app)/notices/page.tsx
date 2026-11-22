import { MegaphoneIcon } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { NoticeTypeBadge } from "@/components/common/status-badges";
import { LocalTime } from "@/components/local-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Role, requireRole } from "@/auth";
import { toActor } from "@/server/action";
import { noticeService } from "@/server/notice/service";
import { DeleteNoticeButton, NoticeForm } from "./notice-client";

export const metadata: Metadata = { title: "Notices" };

/** Feature map rows 21–23 (legacy /addNotice). HR only. */
export default async function NoticesPage() {
  const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  const actor = toActor(session);
  const notices = await noticeService.listNotices(actor);

  return (
    <>
      <PageHeader
        title="Notices"
        description="Notices appear on everyone's dashboard (the five newest). Notices can't be edited; delete and re-post instead."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Notices" },
        ]}
      />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Post a notice</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NoticeForm />
          </CardContent>
        </Card>

        {notices.length === 0 ? (
          <EmptyState
            icon={MegaphoneIcon}
            title="No notices posted yet"
            description="Notices you post will be listed here."
          />
        ) : (
          <Card className="py-0">
            <Table>
              <caption className="sr-only">All notices, newest first</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="pl-4">
                    Notice
                  </TableHead>
                  <TableHead scope="col">Type</TableHead>
                  <TableHead scope="col" className="hidden sm:table-cell">
                    Posted
                  </TableHead>
                  <TableHead scope="col" className="pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notices.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="max-w-md pl-4 whitespace-normal">
                      <p className="font-medium">{n.title}</p>
                      <p className="line-clamp-2 text-muted-foreground">
                        {n.body}
                      </p>
                    </TableCell>
                    <TableCell>
                      <NoticeTypeBadge type={n.type} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <LocalTime value={n.createdAt} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <DeleteNoticeButton id={n.id} title={n.title} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
