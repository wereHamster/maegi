import { mkdirp } from "mkdirp";
import * as path from "path";
import textTable from "text-table";
import { generate, Icon, writeIconModule } from "../../cli/shared";
import { groupBy } from "../../cli/stdlib/groupBy";

interface Options {
  verbose: boolean;
}

export default async function (
  { verbose }: Options,
  base: string,
  { output }: { output: string },
  icons: Array<Icon>
) {
  const allSizes = [...new Set(icons.map((x) => x.size))].sort(
    (a, b) => +a - +b
  );
  const groups = groupBy((x) => x.name, icons);
  const names = [...groups.keys()].sort();

  /*
   * Generate the files, everything in parallel.
   */
  await mkdirp(path.join(base, output));
  await Promise.all([
    /*
     * … individual icon modules
     */
    ...[...groups.entries()].map(writeIconModule(path.join(base, output))),

    /*
     * … index file which re-exports all icons.
     */
    generate(path.join(base, output, "index.ts"), async (write) => {
      for (const name of names) {
        await write(`export * from "./${name}"\n`);
      }
    }),

    /*
     * … descriptors for the documentation.
     */
    generate(path.join(base, output, "descriptors.ts"), async (write) => {
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

  if (verbose) {
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

          const instances = groups.get(name) || [];
          const sizes = allSizes.map((x) =>
            instances.some((i) => i.size === x)
              ? "*".padStart(2)
              : "".padStart(2)
          );

          return [`${symbol} ${name.padEnd(10)}`, ...sizes];
        }),
      ])
    );
    console.log("");
  }
}
