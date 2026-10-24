import * as fs from "node:fs";
import * as path from "node:path";
import { type Assets, emptyAssets, parseIconName } from "../../shared";

export async function loadAssets(basePath: string, source: string): Promise<Assets> {
  return {
    ...emptyAssets,

    get icons() {
      const dir = path.join(basePath, new URL(source).pathname);

      return (async () => {
        const iconNames = await (async () => {
          const allFiles = await fs.promises.readdir(dir);
          return allFiles.flatMap((icon) => {
            const iconName = parseIconName(icon);
            return iconName ? [iconName] : [];
          });
        })();

        return Promise.all(
          iconNames.map(async ({ id, name, size }) => ({
            src: await fs.promises.readFile(`${path.join(dir, id)}.svg`, "utf8"),
            name,
            size,
          })),
        );
      })();
    },
  };
}
