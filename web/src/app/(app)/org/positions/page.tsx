import type { Metadata } from "next";

import { Role, requireRole } from "@/auth";
import { toActor } from "@/server/action";
import { orgService } from "@/server/org/service";
import { OrgUnitPage } from "../_components/org-unit-page";

export const metadata: Metadata = { title: "Positions" };

/** Feature map rows 18–20 (legacy /hr/addPos). HR only. */
export default async function PositionsPage() {
  const session = await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  const actor = toActor(session);
  const positions = await orgService.listPositions(actor);
  return <OrgUnitPage kind="position" rows={positions} />;
}
