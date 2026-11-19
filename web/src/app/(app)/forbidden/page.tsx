import type { Metadata } from "next";

import { ForbiddenState } from "@/components/common/forbidden-state";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false },
};

/**
 * 403 page for signed-in users who open a page their role can't use
 * (e.g. an employee opening /employees). Lives inside the shell so the
 * user keeps their own navigation. Security decides whether
 * requireRole(..., { onFail: "redirect" }) sends users here or pages render
 * <ForbiddenState> in place. A redirect target can't set HTTP 403; render
 * in place if the status code matters.
 */
export default async function ForbiddenPage() {
  // TODO(Security): await requireSession({ onFail: "redirect" });
  return <ForbiddenState />;
}
