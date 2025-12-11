import { array, either, ord, pipeable } from "fp-ts";
import * as t from "io-ts";
import { mkdirp } from "mkdirp";
import * as path from "path";
import { generate, TextStyle } from "../../cli/shared";

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
  textStyles: Array<TextStyle>
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
  for (const { name, style } of textStyles) {
    deepSet(obj, style, name.split("/").map(camelize));
  }

  generate(path.join(base, output), async (write) => {
    const sorted = pipeable.pipe(
      Object.entries(obj),
      array.sortBy([
        ord.contramap<string, [string, unknown]>((x) => x[0])(ord.ordString),
      ])
    );

    for (const [k, v] of sorted) {
      await write(
        `export const ${camelize(k)} = ${JSON.stringify(v)} as const\n`,
        {
          prettier: {},
        }
      );
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

function camelize(str: string) {
  return str
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
}
