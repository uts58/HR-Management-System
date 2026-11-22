import "server-only";

import { revalidatePath } from "next/cache";

export function revalidateApp(): void {
  revalidatePath("/", "layout");
}
