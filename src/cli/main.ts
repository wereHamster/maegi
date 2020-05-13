import { pipeable, either } from "fp-ts";
import * as fs from "fs";
import mkdirp from "mkdirp";
import * as path from "path";
import sharp from "sharp";
import textTable from "text-table";
import { Config, Source } from "../config";
import { generate, Icon, Image, writeIconModule } from "./shared";
import { Figma, Local } from "./source";
import { groupBy } from "./stdlib/groupBy";
import YAML from "yaml";

interface Options {
  verbose: boolean;
  config: string;
  figmaToken?: string;
}

export async function main(options: Options): Promise<void> {
  if (options.config) {
    const base = path.dirname(options.config);
    const raw = YAML.parse(fs.readFileSync(options.config, "utf-8"));
    await pipeable.pipe(
      Config.decode(raw),
      either.fold(
        async (err) => {
          console.log(err);
          process.exit(1);
        },
        async (config) => {
          for (const source of config.sources) {
            await run(
              { figmaToken: process.env.FIGMA_TOKEN, ...options },
              base,
              source
            );
          }
        }
      )
    );
  }
}

async function run(
  options: Options,
  base: string,
  { source, extractors }: Source
): Promise<void> {
  const { icons, images } = await (async () => {
    if (source.startsWith("figma://")) {
      return Figma.loadAssets(options, source);
    } else {
      return Local.loadAssets(base, source);
    }
  })();

  if (extractors.icons) {
    await emitIcons(options, base, extractors.icons as any, icons);
  }

  if (extractors.assets) {
    await emitImages(options, base, extractors.assets as any, images);
  }
}

async function emitIcons(
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

async function emitImages(
  {}: Options,
  base: string,
  { output }: { output: string },
  images: Array<Image>
) {
  await mkdirp(path.join(base, output));

  for (const image of images) {
    await mkdirp(path.join(base, output, path.dirname(image.name)));

    if ("svg" in image) {
      const stream = fs.createWriteStream(
        path.join(base, output, `${image.name}.svg`)
      );
      stream.write(image.svg);
      await new Promise((resolve) => stream.end(resolve));
    } else if ("buffer" in image) {
      const stream = fs.createWriteStream(
        path.join(base, output, `${image.name}.webp`)
      );
      stream.write(
        await sharp(image.buffer).webp({ lossless: true }).toBuffer()
      );
      await new Promise((resolve) => stream.end(resolve));
    }
  }
}
