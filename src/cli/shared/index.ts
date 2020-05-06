import * as fs from "fs";
import mkdirp from "mkdirp";
import * as path from "path";
import prettier from "prettier";

export function toCamelCase(x: string) {
  return ("_" + x.replace(/^ic_/, "")).replace(
    /^([A-Z])|[\s-_](\w)/g,
    function (_match, p1, p2) {
      return p2 ? p2.toUpperCase() : p1.toLowerCase();
    }
  );
}

export function parseFilename(s: string): { name: string; size: number } {
  const sizeMatch = s.match(/_(\d+)dp(\.svg)?$/);

  return {
    name: toCamelCase(path.basename(s, ".svg").replace(/_(\d+)dp$/, "")),
    size: sizeMatch ? +sizeMatch[1] : 0,
  };
}

export async function generate(
  filename: string,
  f: (_: (str: string, options?: any) => void) => void
): Promise<void> {
  const stream = fs.createWriteStream(filename);

  stream.write(`/*\n`);
  stream.write(` * !!! THIS IS A GENERATED FILE – DO NOT EDIT !!!\n`);
  stream.write(` */\n`);
  stream.write(`\n`);

  f((str, options = {}) => {
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
  interface Instances {
    size: number;
    code: string;
  }

  return async ([name, instances]: [string, Instances[]]) => {
    await mkdirp(path.join(base, name));
    await generate(path.join(base, name, "index.tsx"), (write) => {
      write(`import React from "react";\n`);
      write(`\n`);

      const sortedInstances = [...instances].sort((a, b) => a.size - b.size);
      for (const { code } of sortedInstances) {
        write(`${code}`, { prettier: { printWidth: Infinity } });
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
