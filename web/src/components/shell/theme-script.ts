// Not a client module on purpose: the root layout (a Server Component)
// inlines THEME_INIT_SCRIPT, and constants imported from a "use client"
// file would arrive as client references instead of strings.

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "hr-theme";

/**
 * Inline script for the root layout <head>. Runs before first paint so the
 * page never flashes the wrong theme (Next.js "preventing flash" guide).
 * Keep it tiny and dependency-free.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
