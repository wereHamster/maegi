import mkdirp from "mkdirp";
import * as path from "path";
import { Color, generate } from "../../cli/shared";

interface Options {
  verbose: boolean;
}

export default async function (
  {}: Options,
  base: string,
  { output }: { output: string },
  colors: Array<Color>
) {
  await mkdirp(path.join(base, path.dirname(output)));

  const obj: any = {};
  for (const c of colors) {
    deepSet(obj, c.color, c.name.split("/"));
  }

  generate(path.join(base, output), async (write) => {
    for (const [k, v] of Object.entries(obj)) {
      await write(`export const ${k} = ${JSON.stringify(v)}\n`, {
        prettier: {},
      });
    }
  });

  function deepSet(obj: any, value: unknown, path: string[]) {
    let i;
    for (i = 0; i < path.length - 1; i++) {
      if (!obj[path[i]]) {
        obj[path[i]] = {};
      }
      obj = obj[path[i]];
    }
    obj[path[i]] = value;
  }
}
