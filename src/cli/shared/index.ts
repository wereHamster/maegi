import * as svgr from "@svgr/core";
import * as fs from "fs";
import mkdirp from "mkdirp";
import * as path from "path";
import prettier from "prettier";
import { Icon } from "./types";

export * from "./types";

export function toCamelCase(x: string) {
  return ("_" + x.replace(/^ic_/, "")).replace(
    /^([A-Z])|[\s-_](\w)/g,
    function (_match, p1, p2) {
      return p2 ? p2.toUpperCase() : p1.toLowerCase();
    }
  );
}

export function parseIconName(s: string) {
  const sizeMatch = s.match(/ic_(.*)_(\d+)dp(\.svg)?$/);
  if (!sizeMatch) {
    return undefined;
  }

  return {
    id: path.basename(s, ".svg"),
    name: toCamelCase(path.basename(s, ".svg").replace(/_(\d+)dp$/, "")),
    size: sizeMatch ? +sizeMatch[2] : 0,
  };
}

export async function generate(
  filename: string,
  f: (_: (str: string, options?: any) => Promise<void>) => Promise<void>
): Promise<void> {
  const stream = fs.createWriteStream(filename);

  stream.write(`/*\n`);
  stream.write(` * Code generated by maegi. DO NOT EDIT.\n`);
  stream.write(` */\n`);
  stream.write(`\n`);

  await f(async (str, options = {}) => {
    if (options.prettier) {
      stream.write(
        prettier.format(str, {
          parser: "typescript",
          ...options.prettier,
        })
      );
    } else {
      stream.write(str);
    }
  });

  return new Promise((resolve) => stream.end(resolve));
}

/**
 * Returns a function which is used to generate a React icon module (ie. a ES module
 * which exports a bunch of icons).
 */
export function writeIconModule(base: string) {
  return async ([name, instances]: [string, Icon[]]) => {
    await mkdirp(path.join(base, name));
    await generate(path.join(base, name, "index.tsx"), async (write) => {
      write(`import React from "react";\n`);
      write(`\n`);

      const sortedInstances = [...instances].sort((a, b) => a.size - b.size);
      for (const icon of sortedInstances) {
        write(`${await iconCode(icon)}`, {
          prettier: { printWidth: Infinity },
        });
        write(`\n`);
      }

      write(
        `export const __descriptor_${name} = {
    name: "${name}",
    instances: [
      ${sortedInstances
        .map(
          ({ size }) =>
            `{ size: ${size || `"responsive"`}, Component: ${name}${
              size || ""
            } }`
        )
        .join(",")}
    ]
  } as const;
  `,
        { prettier: {} }
      );
    });
  };
}

/**
 * Convert an Icon into React code.
 */
export async function iconCode({ name, size, src }: Icon): Promise<string> {
  const options: svgr.Config = {
    template({ componentName, jsx }, { tpl }) {
      return tpl`
        export const ${componentName} = React.memo<React.SVGProps<SVGSVGElement>>(props => ${jsx});
      `;
    },
    plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
    svgoConfig: {
      multipass: true,
      plugins: [
        { name: "removeViewBox", active: false },
        { name: "sortAttrs", active: true },
        { name: "convertColors", params: { currentColor: true } },
        { name: "removeAttrs", params: { attrs: "(xmlns.*)" } },
      ],
    },
  };

  return svgr.transform(src, options, {
    componentName: `${name}${size}`,
  });
}
