try {
  await import("./env");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  // register() errors are logged and ignored, so exit explicitly.
  process.exit(1);
}

export {};
