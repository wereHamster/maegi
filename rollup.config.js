import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import babel from "@rollup/plugin-babel";
import externals from "rollup-plugin-node-externals";
import terser from "@rollup/plugin-terser";

const extensions = [".js", ".jsx", ".ts", ".tsx"];

export default [
  {
    input: "src/cli/index.ts",
    output: {
      file: "packages/cli/index.js",
      format: "commonjs",
      inlineDynamicImports: true,
    },
    plugins: [
      externals(),
      resolve({ extensions }),
      commonjs(),
      terser(),
      babel({
        extensions,
        presets: ["@babel/preset-typescript"],
      }),
    ],
    external: [
      ...require("builtin-modules"),
      ...Object.keys(require("./packages/cli/package.json").dependencies),
    ],
  },
];
