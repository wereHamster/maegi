import * as svgr from "@svgr/core";
import program from "commander";
import * as fs from "fs";
import mkdirp from "mkdirp";
import fetch from "node-fetch";
import * as path from "path";
import prettier from "prettier";
import textTable from "text-table";
import { groupBy } from "./stdlib/groupBy";

program
  .arguments("<source>")
  .option("-o, --output <dir>", "output directory")
  .action(main);

program.parse(process.argv);

function toCamelCase(x: string) {
  return ("_" + x.replace(/^ic_/, "")).replace(
    /^([A-Z])|[\s-_](\w)/g,
    function (_match, p1, p2) {
      return p2 ? p2.toUpperCase() : p1.toLowerCase();
    }
  );
}

function parseFilename(s: string): { name: string; size: number } {
  const sizeMatch = s.match(/_(\d+)dp(\.svg)?$/);

  return {
    name: toCamelCase(path.basename(s, ".svg").replace(/_(\d+)dp$/, "")),
    size: sizeMatch ? +sizeMatch[1] : 0,
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
          ...options.prettier,
        })
      );
    } else {
      stream.write(str);
    }
  });

  return new Promise((resolve) => stream.end(resolve));
}

async function main(source: string, options: any): Promise<void> {
  const { output = path.join(process.env.PWD, "src", "icons") } = options;

  /*
   * Load all icons from the source folder into memory.
   */
  const icons = await loadIcons(source);
  const allSizes = [...new Set(icons.map((x) => x.size))].sort(
    (a, b) => +a - +b
  );
  const groups = groupBy((x) => x.name, icons);
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
    generate(path.join(output, "index.ts"), (write) => {
      for (const name of names) {
        write(`export * from "./${name}"\n`);
      }
    }),

    /*
     * … descriptors for the documentation.
     */
    generate(path.join(output, "descriptors.ts"), (write) => {
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
          (name) => `__descriptor_${name}`
        )}]`,
        { prettier: {} }
      );
    }),
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
        const sizes = allSizes.map((x) =>
          instances.some((i) => i.size === x) ? "*".padStart(2) : "".padStart(2)
        );

        return [`${symbol} ${name.padEnd(10)}`, ...sizes];
      }),
    ])
  );
  console.log("");
}

async function enumerateIcons(source: string): Promise<string[]> {
  if (source.startsWith("figma://")) {
  } else {
    const allFiles = await fs.promises.readdir(source);
    return allFiles.filter((icon) => icon.match(/^ic_.*\.svg$/));
  }
}

async function loadIcons(source: string) {
  const ids = await enumerateIcons(source);

  const options = {
    template({ template }, _, { componentName, jsx }) {
      return template.smart({ plugins: ["typescript"] })
        .ast`export const ${componentName} = React.memo<React.SVGProps<SVGSVGElement>>(props => ${jsx});`;
    },
    plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
    svgoConfig: {
      multipass: true,
      plugins: [
        { removeViewBox: false },
        { sortAttrs: true },
        { convertColors: { currentColor: true } },
        { removeAttrs: { attrs: "(xmlns.*)" } },
      ],
    },
  };

  if (source.startsWith("figma://")) {
    const { key, id } = (() => {
      const { host: key, pathname } = new URL(source);
      return { key, id: pathname.substring(1) };
    })();

    const nodes = await (async () => {
      const json = await fetch(
        `https://api.figma.com/v1/files/${key}/nodes?ids=${id}`,
        {
          headers: {
            "X-FIGMA-TOKEN": process.env.FIGMA_TOKEN,
          },
        }
      ).then((res) => res.json());

      return json.nodes[id].document.children
        .map((node) => ({
          id: node.id,
          name: node.name,
        }))
        .filter((n) => n.name.match(/ic_/));
    })();

    console.log(nodes)

    const ids = nodes.map((n) => n.id);
    const { images } = await fetch(
      `https://api.figma.com/v1/images/${key}?ids=${ids.join(",")}&format=svg`,
      {
        headers: {
          "X-FIGMA-TOKEN": process.env.FIGMA_TOKEN,
        },
      }
    ).then((res) => res.json());

    return Promise.all(
      Object.keys(images).map(async (k) => {
        const { name, size } = parseFilename(
          nodes.find((n) => n.id === k)!.name
        );

        const url = images[k];
        const src = await fetch(url).then((res) => res.text());

        const code = await svgr.default(src, options, {
          componentName: `${name}${size}`,
        });

        return { code, src, name, size };
      })
    );
  } else {
    const ids = await (async () => {
      const allFiles = await fs.promises.readdir(source);
      return allFiles.filter((icon) => icon.match(/^ic_.*\.svg$/));
    })();

    return await Promise.all(
      ids.map(async (id) => {
        const { name, size } = parseFilename(id);
        const src = await fs.promises.readFile(path.join(source, id), "utf8");

        const code = await svgr.default(src, options, {
          componentName: `${name}${size}`,
        });

        return { code, src, name, size };
      })
    );
  }
}

function writeIconModule(base: string) {
  return async ([name, instances]: [string, any]) => {
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
