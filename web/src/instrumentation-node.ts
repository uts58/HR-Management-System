// Node.js-runtime startup checks. Imported only from instrumentation.ts.
// Validates the environment so a misconfigured deployment fails at boot.
try {
  await import("./env");
} catch (error) {
  // Next.js logs errors thrown from register() and keeps serving, so exit
  // explicitly. The container then restarts and shows as unhealthy instead
  // of serving broken pages.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

export {};
