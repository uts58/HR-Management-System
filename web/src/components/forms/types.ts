import type { ActionResult } from "@/contracts";

export type FormAction<T = void> = (
  previous: ActionResult<T> | null,
  formData: FormData,
) => Promise<ActionResult<T>>;
