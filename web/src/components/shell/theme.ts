"use client";

import { useCallback, useSyncExternalStore } from "react";

export type { ThemePreference } from "./theme-script";
import type { ThemePreference } from "./theme-script";

import { THEME_STORAGE_KEY } from "./theme-script";

const listeners = new Set<() => void>();

function read(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(preference: ThemePreference) {
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (read() === "system") apply("system");
    listener();
  };
  media.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
  };
}

/** Current theme preference plus a setter that persists and applies it. */
export function useTheme(): [ThemePreference, (next: ThemePreference) => void] {
  const preference = useSyncExternalStore(
    subscribe,
    read,
    (): ThemePreference => "system",
  );
  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: still apply for this page view.
    }
    apply(next);
    listeners.forEach((listener) => listener());
  }, []);
  return [preference, setPreference];
}
