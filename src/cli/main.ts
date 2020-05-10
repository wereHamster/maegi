import * as fs from "fs";
import mkdirp from "mkdirp";
import * as path from "path";
import sharp from "sharp";
import textTable from "text-table";
import { generate, Icon, Image, writeIconModule } from "./shared";
import { Figma, Local } from "./source";
import { groupBy } from "./stdlib/groupBy";

interface Options {
  verbose: boolean;
  icons: string;
  images: string;
}

export async function main(source: string, options0: any): Promise<void> {
  const defaultOptions = {
    icons: path.join(process.env.PWD!, "src", "icons"),
    images: path.join(process.env.PWD!, "assets"),
  };

  const options = { ...defaultOptions, ...options0 };

  const { icons, images } = await (async () => {
    if (source.startsWith("figma://")) {
      return Figma.loadAssets(source);
    } else {
      return Local.loadAssets(source);
    }
  })();

  if (options.icons) {
    await emitIcons(options, icons);
  }

  if (options.images) {
    await emitImages(options, images);
  }
}

async function emitIcons(opts: Options, icons: Array<Icon>) {
  const allSizes = [...new Set(icons.map((x) => x.size))].sort(
    (a, b) => +a - +b
  );
  const groups = groupBy((x) => x.name, icons);
  const names = [...groups.keys()].sort();

  /*
   * Generate the files, everything in parallel.
   */
  await mkdirp(opts.icons);
  await Promise.all([
    /*
     * … individual icon modules
     */
    ...[...groups.entries()].map(writeIconModule(opts.icons)),

    /*
     * … index file which re-exports all icons.
     */
    generate(path.join(opts.icons, "index.ts"), async (write) => {
      for (const name of names) {
        await write(`export * from "./${name}"\n`);
      }
    }),

    /*
     * … descriptors for the documentation.
     */
    generate(path.join(opts.icons, "descriptors.ts"), async (write) => {
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

  if (opts.verbose) {
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

async function emitImages(opts: Options, images: Array<Image>) {
  await mkdirp(opts.images);

  for (const image of images) {
    await mkdirp(path.join(opts.images, path.dirname(image.name)));

    if ("svg" in image) {
      const stream = fs.createWriteStream(
        path.join(opts.images, `${image.name}.svg`)
      );
      stream.write(image.svg);
      await new Promise((resolve) => stream.end(resolve));
    } else if ("buffer" in image) {
      const stream = fs.createWriteStream(
        path.join(opts.images, `${image.name}.webp`)
      );
      stream.write(
        await sharp(image.buffer).webp({ lossless: true }).toBuffer()
      );
      await new Promise((resolve) => stream.end(resolve));
    }
  }
}
