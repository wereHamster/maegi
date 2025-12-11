import * as fs from "node:fs";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import terser from "@rollup/plugin-terser";
import builtinModules from "builtin-modules";

const extensions = [".js", ".jsx", ".ts", ".tsx"];

// Reads dependencies from a package's package.json to mark them as external
// For the CLI package, this includes only 'sharp' (which has native code and should not be bundled)
function externalFor(pkg) {
  const packageJson = JSON.parse(fs.readFileSync(`packages/${pkg}/package.json`, "utf8"));

  return [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
  ];
}

export default [
  {
    input: "src/cli/index.ts",
    output: {
      file: "packages/cli/index.js",
      format: "commonjs",
      inlineDynamicImports: true,
    },
    plugins: [
      resolve({ extensions }),
      commonjs(),
      terser(),
      babel({
        extensions,
        presets: ["@babel/preset-typescript"],
      }),
    ],
    external: [
      ...builtinModules,
      ...externalFor("cli"),
    ],
  },
];
