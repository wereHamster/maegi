import * as fs from "fs";
import * as path from "path";
import { Assets, parseIconName } from "../../shared";

export async function loadAssets(source: string): Promise<Assets> {
  const { pathname: dir } = new URL(source);

  const iconNames = await (async () => {
    const allFiles = await fs.promises.readdir(dir);
    return allFiles.flatMap((icon) => {
      const iconName = parseIconName(icon);
      return iconName ? [iconName] : [];
    });
  })();

  const icons = await Promise.all(
    iconNames.map(async ({ id, name, size }) => ({
      src: await fs.promises.readFile(path.join(dir, id) + ".svg", "utf8"),
      name,
      size,
    }))
  );

  return { icons, images: [] };
}
