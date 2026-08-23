// CipherScan — api-server build script
// Bundles src/index.ts -> dist/index.mjs using esbuild.
// Workspace + node_modules packages are left external (not bundled) so
// this stays fast and avoids native-binding bundling issues (pg, etc).
// Requires lib/db, lib/api-zod to already be built (dist/ present) since
// Node resolves them via the "default" export at runtime.

import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  packages: "external",
});

console.log("Build complete: dist/index.mjs");
