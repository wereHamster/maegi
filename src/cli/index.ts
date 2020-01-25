import svgr from "@svgr/core";
import program from "commander";
import * as fs from "fs";
import mkdirp from "mkdirp";
import * as path from "path";
import prettier from "prettier";
import { groupBy } from "./stdlib/groupBy";
import textTable from "text-table";

program
  .arguments("<source>")
  .option("-o, --output <dir>", "output directory")
  .action(main);

program.parse(process.argv);

function toCamelCase(x: string) {
  return ("_" + x.replace(/^ic_/, "")).replace(/^([A-Z])|[\s-_](\w)/g, function(
    _match,
    p1,
    p2
  ) {
    return p2 ? p2.toUpperCase() : p1.toLowerCase();
  });
}

function parseFilename(s: string): { name: string; size: number } {
  const sizeMatch = s.match(/_(\d+)dp\.svg$/);

  return {
    name: toCamelCase(path.basename(s, ".svg").replace(/_(\d+)dp$/, "")),
    size: sizeMatch ? +sizeMatch[1] : 0
  };
}

async function generate(
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
          ...options.prettier
        })
      );
    } else {
      stream.write(str);
    }
  });

  return new Promise(resolve => stream.end(resolve));
}

async function main(source: string, options: any): Promise<void> {
  const { output = path.join(process.env.PWD, "src", "icons") } = options;

  /*
   * Load all icons from the source folder into memory.
   */
  const icons = await loadIcons(source);
  const allSizes = [...new Set(icons.map(x => x.size))].sort((a, b) => +a - +b);
  const groups = groupBy(x => x.name, icons);
  const names = [...groups.keys()].sort();

  /*
   * Generate the files, everything in parallel.
   */
  await mkdirp(output);
  await Promise.all([
    /*
     * … individual icon modules
     */
    ...[...groups.entries()].map(writeIconModule(output)),

    /*
     * …  index file which re-exports all icons.
     */
    generate(path.join(output, "index.ts"), write => {
      for (const name of names) {
        write(`export * from "./${name}"\n`);
      }
    }),

    /*
     * … descriptors for the documentation.
     */
    generate(path.join(output, "descriptors.ts"), write => {
      write(`import { Descriptor } from "@valde/iconography"\n`);
      write(`\n`);

      for (const name of names) {
        write(`import { __descriptor_${name} } from "./${name}"\n`);
      }

      write(`\n`);
      write(`export type Size = ${allSizes.join(" | ")}\n`);
      write(`export const enumSize: Size[] = [ ${allSizes.join(", ")} ]\n`);
      write(`\n`);
      write(
        `export const descriptors: Descriptor[] = [${names.map(
          name => `__descriptor_${name}`
        )}]`,
        { prettier: {} }
      );
    })
  ]);

  /*
   * Print statistics to stdout.
   */
  console.log("");
  console.log(
    textTable([
      ["", ...allSizes],
      [],
      ...names.map((name, i) => {
        const symbol =
          i === 0
            ? names.length === 1
              ? "─"
              : "┌"
            : i === names.length - 1
            ? "└"
            : "├";

        const instances = groups.get(name);
        const sizes = allSizes.map(x =>
          instances.some(i => i.size === x) ? "*".padStart(2) : "".padStart(2)
        );

        return [`${symbol} ${name.padEnd(10)}`, ...sizes];
      })
    ])
  );
  console.log("");
}

async function enumerateIcons(sourceFolder: string): Promise<string[]> {
  const allFiles = await fs.promises.readdir(sourceFolder);
  return allFiles.filter(icon => icon.match(/^ic_.*\.svg$/));
}

async function loadIcons(sourceFolder: string) {
  const icons = await enumerateIcons(sourceFolder);

  const options = {
    template({ template }, _, { componentName, jsx }) {
      return template.smart({ plugins: ["typescript"] })
        .ast`export const ${componentName} = React.memo<React.SVGProps<SVGSVGElement>>(props => ${jsx});`;
    },
    prettier: false,
    plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx", "@svgr/plugin-prettier"],
    svgoConfig: {
      multipass: true,
      plugins: [
        { removeViewBox: false },
        { sortAttrs: true },
        { convertColors: { currentColor: true } },
        { removeAttrs: { attrs: "(xmlns.*)" } }
      ]
    }
  };

  return await Promise.all(
    icons.map(async icon => {
      const { name, size } = parseFilename(icon);
      const src = await fs.promises.readFile(
        path.join(sourceFolder, icon),
        "utf8"
      );

      const code = await svgr.default(src, options, {
        componentName: `${name}${size}`
      });

      return { code, src, name, size };
    })
  );
}

function writeIconModule(base: string) {
  return async ([name, instances]: [string, any]) => {
    await mkdirp(path.join(base, name));
    await generate(path.join(base, name, "index.tsx"), write => {
      write(`import * as React from "react";\n`);
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
            `{ size: ${size || `"responsive"`}, Component: ${name}${size} }`
        )
        .join(",")}
    ]
  };
  `,
        { prettier: {} }
      );
    });
  };
}
