// Copies public/ and .next/static into .next/standalone, as the Next.js
// `output: "standalone"` docs require, so that
// `node .next/standalone/server.js` serves static assets. The Dockerfile
// does the same with COPY.
import { cpSync, existsSync } from "node:fs";

const standalone = ".next/standalone";
if (!existsSync(`${standalone}/server.js`)) {
  console.error(
    `${standalone}/server.js not found. Run \`npm run build\` first.`,
  );
  process.exit(1);
}
cpSync("public", `${standalone}/public`, { recursive: true });
cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
