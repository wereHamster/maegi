import mkdirp from "mkdirp";
import * as path from "path";
import { Color, generate } from "../../cli/shared";
import * as t from "io-ts";
import { array, either, ord, pipeable } from "fp-ts";

interface Env {
  verbose: boolean;
}

const Options = t.type({
  output: t.string,
});
type Options = t.TypeOf<typeof Options>;

export default async function (
  {}: Env,
  base: string,
  rawOptions: unknown,
  colors: Array<Color>
) {
  const options = pipeable.pipe(
    Options.decode(rawOptions),
    either.fold(
      (err) => {
        console.log("Could not parse extractor options");
        console.log(err);
        process.exit(1);
      },
      (config) => {
        return config;
      }
    )
  );

  const { output } = options;

  await mkdirp(path.join(base, path.dirname(output)));

  const obj: any = {};
  for (const c of colors) {
    deepSet(obj, c.color, c.name.split("/"));
  }

  generate(path.join(base, output), async (write) => {
    const sorted = pipeable.pipe(
      Object.entries(obj),
      array.sortBy([
        ord.contramap<string, [string, unknown]>((x) => x[0])(ord.ordString),
      ])
    );

    for (const [k, v] of sorted) {
      await write(`export const ${k} = ${JSON.stringify(v)} as const\n`, {
        prettier: {},
      });
      await write("\n");
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
