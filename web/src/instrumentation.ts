// Runs once when the Next.js server starts.
// Node-only work lives in instrumentation-node.ts. The `NEXT_RUNTIME` check
// is inlined at compile time, so that module never ends up in the Edge
// bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
