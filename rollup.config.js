import babel from "rollup-plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default [
  {
    input: "src/cli/index.ts",
    output: {
      file: "packages/cli/index.js",
      format: "esm"
    },
    plugins: [
      resolve(),
      commonjs(),
      babel({
        extensions: [".js", ".jsx", ".ts", ".tsx"],
        presets: ["@babel/preset-typescript"]
      })
    ],
    external: [
      ...require("builtin-modules"),
      ...Object.keys(require("./packages/cli/package.json").dependencies)
    ]
  }
];
