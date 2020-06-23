import * as fs from "fs";
import mkdirp from "mkdirp";
import * as path from "path";
import sharp from "sharp";
import { Image } from "../../cli/shared";

interface Options {
  verbose: boolean;
}

export default async function (
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
