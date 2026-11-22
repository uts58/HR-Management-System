import type { Metadata } from "next";

import { requireSession } from "@/auth";
import { ForbiddenState } from "@/components/common/forbidden-state";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false },
};

export default async function ForbiddenPage() {
  await requireSession({ onFail: "redirect" });
  return <ForbiddenState />;
}
