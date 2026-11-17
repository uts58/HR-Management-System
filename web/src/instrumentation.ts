// Runs once when the Next.js server starts.
// Platform-owned. It validates the environment so a misconfigured
// deployment fails at boot.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    await import("./env");
  } catch (error) {
    // Next.js logs errors thrown here and keeps serving, so exit explicitly.
    // The container then restarts and shows as unhealthy instead of serving
    // broken pages.
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
