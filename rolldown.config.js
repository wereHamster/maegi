import * as fs from "node:fs";
import { defineConfig } from "rolldown";

function externalFor(pkg) {
  const packageJson = JSON.parse(fs.readFileSync(`packages/${pkg}/package.json`, "utf8"));

  return [...Object.keys(packageJson.dependencies || {}), ...Object.keys(packageJson.peerDependencies || {})];
}

export default defineConfig({
  input: "src/cli/index.ts",
  platform: "node",

  /*
   * Prefer the ES module build of dependencies. Rolldown defaults to `main` on
   * the node platform, which picks the CommonJS builds of fp-ts and io-ts and
   * prevents them from being tree-shaken.
   */
  resolve: { mainFields: ["module", "main"] },

  external: externalFor("cli"),

  output: {
    file: "packages/cli/index.js",
    format: "es",
    codeSplitting: false,
    minify: true,
  },
});
