import svgr from "@svgr/core";
import * as fs from "fs";
import mkdirp from "mkdirp";
import * as path from "path";
import prettier from "prettier";

import program from "commander";

program
  .arguments("<source>")
  .option("-o, --output <dir>", "output directory")
  .action((sourceFolder, options) => {
    const __dirname = options.output;

    function toCamelCase(x) {
      return ("_" + x.replace(/^ic_/, "")).replace(
        /^([A-Z])|[\s-_](\w)/g,
        function(match, p1, p2) {
          return p2 ? p2.toUpperCase() : p1.toLowerCase();
        }
      );
    }

    function generate(filename, f) {
      const stream = fs.createWriteStream(filename);
      console.log(filename);

      stream.write(`/*\n`);
      stream.write(` * !!! THIS IS A GENERATED FILE – DO NOT EDIT !!!\n`);
      stream.write(` */\n`);
      stream.write(`\n`);

      f((str, options = {}) => {
        if (options.prettier) {
          stream.write(
            prettier.format(str, { parser: "typescript", ...options.prettier })
          );
        } else {
          stream.write(str);
        }
      });

      stream.end();
    }

    function processGroup(group) {
      const icons = {};

      mkdirp.sync(path.join(__dirname, group.name));

      fs.readdirSync(sourceFolder)
        .filter(icon => icon.match(/^ic_.*\.svg$/))
        .forEach(icon => {
          const sourceFilePath = path.join(sourceFolder, icon);

          const sizeMatch = icon.match(/_(\d+)dp\.svg$/);
          const size = sizeMatch ? +sizeMatch[1] : 0;

          const name = toCamelCase(
            path.basename(icon, ".svg").replace(/_(\d+)dp$/, "")
          );

          const code = svgr.default.sync(
            fs.readFileSync(sourceFilePath, "utf8"),
            {
              template({ template }, opts, { componentName, jsx }) {
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

      const allSizes = [
        ...new Set(
          (function* f() {
            for (const name in icons) {
              for (const { size } of icons[name]) {
                yield size;
              }
            }
          })()
        )
      ].sort((a, b) => +a - +b);

      for (const name in icons) {
        mkdirp.sync(path.join(__dirname, group.name, name));
        generate(path.join(__dirname, group.name, name, "index.tsx"), write => {
          write(`import * as React from "react";\n`);
          write(`\n`);

          const sortedInstances = [...icons[name]].sort(
            (a, b) => a.size - b.size
          );
          for (const { code } of sortedInstances) {
            write(`${code}`, { prettier: { printWidth: Infinity } });
          }

          write(`\n`);

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

      generate(path.join(__dirname, group.name, "index.ts"), write => {
        for (const name in icons) {
          write(`export * from "./${name}"\n`);
        }
      });

      generate(path.join(__dirname, group.name, "descriptors.ts"), write => {
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
    }

    const groups = [
      {
        name: "monochrome"
      }
    ];

    groups.forEach(processGroup);
  });

program.parse(process.argv);
