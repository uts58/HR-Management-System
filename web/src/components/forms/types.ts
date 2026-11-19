import type { ActionResult } from "@/contracts";

/**
 * Shape a form submit handler must have to plug into <ActionForm>: the
 * `useActionState` reducer signature, i.e. the previous result (null before
 * the first submit) plus the submitted FormData. Open question to Backend:
 * whether actions built with `defineAction` have this shape directly or
 * need a small adapter.
 */
export type FormAction<T = void> = (
  previous: ActionResult<T> | null,
  formData: FormData,
) => Promise<ActionResult<T>>;
