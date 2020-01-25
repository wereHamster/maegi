import svgr from "@svgr/core";
import * as fs from "fs";
import mkdirp from "mkdirp";
import * as path from "path";
import prettier from "prettier";

import program from "commander";

program
  .arguments("<source>")
  .option("-o, --output <dir>", "output directory")
  .action((source, { output = path.join(process.env.PWD, "src", "icons") }) => {
    mkdirp.sync(output);

    /*
     * Load all icons from the source folder into memory.
     */
    const input = fs
      .readdirSync(source)
      .filter(icon => icon.match(/^ic_.*\.svg$/))
      .map(icon => ({
        src: fs.readFileSync(path.join(source, icon), "utf8"),
        ...parseFilename(icon)
      }));

    /*
     * Convert icons into React components and group by name.
     */
    const icons = {};
    input.forEach(({ src, name, size }) => {
      const code = svgr.default.sync(
        src,
        {
          template({ template }, _, { componentName, jsx }) {
            return template.smart({ plugins: ["typescript"] })
              .ast`export const ${componentName} = React.memo<React.SVGProps<SVGSVGElement>>(props => ${jsx});`;
          },
          prettier: false,
          plugins: [
            "@svgr/plugin-svgo",
            "@svgr/plugin-jsx",
            "@svgr/plugin-prettier"
          ],
          svgoConfig: {
            multipass: true,
            plugins: [
              { removeViewBox: false },
              { sortAttrs: true },
              { convertColors: { currentColor: true } },
              { removeAttrs: { attrs: "(xmlns.*)" } }
            ]
          }
        },
        { componentName: `${name}${size}` }
      );

      if (name in icons) {
        icons[name].push({ size, code });
      } else {
        icons[name] = [{ size, code }];
      }
    });

    const allSizes = [...new Set(input.map(x => x.size))].sort(
      (a, b) => +a - +b
    );

    /*
     * Now generate the individual icon components.
     */
    for (const name in icons) {
      mkdirp.sync(path.join(output, name));
      generate(path.join(output, name, "index.tsx"), write => {
        write(`import * as React from "react";\n`);
        write(`\n`);

        const sortedInstances = [...icons[name]].sort(
          (a, b) => a.size - b.size
        );
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
                  `{ size: ${size ||
                    `"responsive"`}, Component: ${name}${size} }`
              )
              .join(",")}
          ]
        };
        `,
          { prettier: {} }
        );
      });
    }

    /*
     * … and the index file which re-exports all icons.
     */
    generate(path.join(output, "index.ts"), write => {
      for (const name in icons) {
        write(`export * from "./${name}"\n`);
      }
    });

    /*
     * – and the descriptors for the documentation.
     */
    generate(path.join(output, "descriptors.ts"), write => {
      write(`import { Descriptor } from "@valde/iconography"\n`);
      write(`\n`);

      for (const name in icons) {
        write(`import { __descriptor_${name} } from "./${name}"\n`);
      }

      write(`\n`);
      write(`export type Size = ${allSizes.join(" | ")}\n`);
      write(`export const enumSize: Size[] = [ ${allSizes.join(", ")} ]\n`);
      write(`\n`);
      write(
        `export const descriptors: Descriptor[] = [${Object.keys(icons).map(
          name => `__descriptor_${name}`
        )}]`,
        { prettier: {} }
      );
    });
  });

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

function generate(
  filename: string,
  f: (_: (str: string, options?: any) => void) => void
): void {
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

  stream.end();
}
