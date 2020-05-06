import * as fs from "fs";
import * as path from "path";
import { Assets, parseFilename } from "../../shared";

export async function loadAssets(source: string): Promise<Assets> {
  const ids = await (async () => {
    const allFiles = await fs.promises.readdir(source);
    return allFiles.filter((icon) => icon.match(/^ic_.*\.svg$/));
  })();

  const icons = await Promise.all(
    ids.map(async (id) => {
      const { name, size } = parseFilename(id);
      const src = await fs.promises.readFile(path.join(source, id), "utf8");

      return { src, name, size };
    })
  );

  return { icons, images: [] };
}
