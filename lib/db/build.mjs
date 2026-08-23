import { execSync } from "child_process";
import { build } from "esbuild";

execSync("tsc -p tsconfig.json", { stdio: "inherit" });

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  allowOverwrite: true,
});

console.log("Build complete: dist/index.js (bundled) + dist/*.d.ts");