import type { Metadata } from "next";

import { requireSession } from "@/auth";
import { ForbiddenState } from "@/components/common/forbidden-state";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false },
};

/**
 * 403 page for signed-in users who open a page their role can't use
 * (e.g. an employee opening /employees). Lives inside the shell so the
 * user keeps their own navigation. requireRole(..., { onFail: "redirect" })
 * sends wrong-role page loads here (Security's ruling). A redirect target
 * can't set HTTP 403; the page answers 200.
 */
export default async function ForbiddenPage() {
  // Signed-out visitors go to /login instead.
  await requireSession({ onFail: "redirect" });
  return <ForbiddenState />;
}
