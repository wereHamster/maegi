import program from "commander";
import mkdirp from "mkdirp";
import * as path from "path";
import textTable from "text-table";
import { generate, writeIconModule, Assets } from "./shared";
import { Figma, Local } from "./source";
import { groupBy } from "./stdlib/groupBy";

program
  .arguments("<source>")
  .option("-o, --output <dir>", "output directory")
  .action(main);

program.parse(process.argv);

async function main(source: string, options: any): Promise<void> {
  const { output = path.join(process.env.PWD, "src", "icons") } = options;

  /*
   * Load all icons from the source folder into memory.
   */
  const { icons } = await loadAssets(source);
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
     * … index file which re-exports all icons.
     */
    generate(path.join(output, "index.ts"), async (write) => {
      for (const name of names) {
        await write(`export * from "./${name}"\n`);
      }
    }),

    /*
     * … descriptors for the documentation.
     */
    generate(path.join(output, "descriptors.ts"), async (write) => {
      for (const name of names) {
        await write(`import { __descriptor_${name} } from "./${name}"\n`);
      }

      await write(`\n`);
      await write(`export type Size = ${allSizes.join(" | ")}\n`);
      await write(
        `export const enumSize: Size[] = [ ${allSizes.join(", ")} ]\n`
      );
      await write(`\n`);
      await write(
        `export const descriptors = [${names.map(
          (name) => `__descriptor_${name}`
        )}] as const`,
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

async function loadAssets(source: string): Promise<Assets> {
  if (source.startsWith("figma://")) {
    return Figma.loadAssets(source);
  } else {
    return Local.loadAssets(source);
  }
}
