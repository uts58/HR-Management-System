import { Building2Icon } from "lucide-react";

import type { Department, Position } from "@/contracts";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DeleteOrgUnitButton, OrgUnitForm } from "./org-unit-client";
import { ORG_UNIT_COPY, type OrgUnitKind } from "./org-unit-copy";

/** Shared body of /org/departments and /org/positions (form + list). */
export function OrgUnitPage({
  kind,
  rows,
}: {
  kind: OrgUnitKind;
  rows: (Department | Position)[];
}) {
  const copy = ORG_UNIT_COPY[kind];
  return (
    <>
      <PageHeader
        title={copy.title}
        description={`Add ${copy.plural} for the employee forms. A ${copy.singular.toLowerCase()} can only be deleted when no employee uses it.`}
        breadcrumbs={[
          { label: "Employees", href: "/employees" },
          { label: copy.title },
        ]}
      />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{copy.addLabel}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <OrgUnitForm kind={kind} />
          </CardContent>
        </Card>

        {rows.length === 0 ? (
          <EmptyState
            icon={Building2Icon}
            title={`No ${copy.plural} added yet`}
            description={`Use the form above to add the first ${copy.singular.toLowerCase()}.`}
          />
        ) : (
          <Card className="py-0">
            <Table>
              <caption className="sr-only">{copy.title}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="w-16 pl-4">
                    ID
                  </TableHead>
                  <TableHead scope="col">{copy.nameLabel}</TableHead>
                  <TableHead scope="col" className="text-right">
                    Employees
                  </TableHead>
                  <TableHead scope="col" className="pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const inactive = row.totalEmployeeCount - row.employeeCount;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="pl-4 text-muted-foreground tabular-nums">
                        {row.id}
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.employeeCount}
                        {inactive > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            +{inactive} terminated
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {row.totalEmployeeCount > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            In use, can&apos;t delete
                          </span>
                        ) : (
                          <DeleteOrgUnitButton
                            kind={kind}
                            id={row.id}
                            name={row.name}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
