"use client";

/**
 * STUB ONLY. Lets reviewers switch between the HR admin, employee and
 * forced-password-change personas while the app runs on stub data.
 * Delete with the rest of app/_stubs when Security's auth lands.
 */

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import type { StubPersona } from "./session";

const COOKIE = "hr-stub-persona";

const LABELS: Record<StubPersona, string> = {
  hr: "HR admin",
  employee: "Employee",
  "must-change": "Must change password",
};

export function PersonaSwitcher({ current }: { current: StubPersona }) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-warning/60 bg-warning/10 px-2 py-1 text-xs text-warning">
      <label htmlFor={id} className="font-medium whitespace-nowrap">
        Stub<span className="hidden sm:inline"> data · view as</span>
      </label>
      <NativeSelect
        id={id}
        size="sm"
        value={current}
        disabled={pending}
        className="text-foreground"
        onChange={(event) => {
          document.cookie = `${COOKIE}=${event.target.value}; path=/; samesite=lax`;
          startTransition(() => {
            router.push(
              event.target.value === "must-change"
                ? "/change-password"
                : "/dashboard",
            );
            router.refresh();
          });
        }}
      >
        {(Object.keys(LABELS) as StubPersona[]).map((p) => (
          <NativeSelectOption key={p} value={p}>
            {LABELS[p]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}
