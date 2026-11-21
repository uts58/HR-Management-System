import type { Metadata } from "next";

import { listPositionsStub } from "../../../_stubs/services";
import { OrgUnitPage } from "../_components/org-unit-page";

export const metadata: Metadata = { title: "Positions" };

/** Feature map rows 18–20 (legacy /hr/addPos). HR only. */
export default async function PositionsPage() {
  // TODO(Security): await requireRole(Role.HR_ADMIN, { onFail: "redirect" });
  // TODO(Backend): orgService.listPositions(actor)
  const positions = await listPositionsStub();
  return <OrgUnitPage kind="position" rows={positions} />;
}
