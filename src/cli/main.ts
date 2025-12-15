import { either, pipeable } from "fp-ts";
import * as fs from "node:fs";
import * as path from "node:path";
import YAML from "yaml";
import { Config, Source } from "../config";
import * as Extractors from "../extractors";
import { Figma, Local } from "./source";

interface Options {
  verbose: boolean;
  figmaToken?: string;
}

export async function main(configPath: string, opts: Options): Promise<void> {
  /*
   * Parse and validate the config file.
   */
  const config = pipeable.pipe(
    Config.decode(YAML.parse(fs.readFileSync(configPath, "utf-8"))),
    either.fold(
      (err) => {
        console.log("Could not decode config file");
        console.log(err);
        process.exit(1);
      },
      (config) => {
        return config;
      }
    )
  );

  /*
   * Paths inside the config file are relative to it (not relative to cwd)!
   */
  const basePath = path.dirname(configPath);

  /*
   * Process all sources in parallel. The majority of configs will have only
   * one source though.
   */
  await Promise.all(
    config.sources.map(async (source) =>
      run({ figmaToken: process.env.FIGMA_TOKEN, ...opts }, basePath, source)
    )
  );
}

async function run(
  options: Options,
  base: string,
  { source, extractors }: Source
): Promise<void> {
  const assets = await (() => {
    if (source.startsWith("figma://")) {
      return Figma.loadAssets(options, source);
    } else {
      return Local.loadAssets(base, source);
    }
  })();

  await Promise.all(
    Object.entries(extractors).map(async ([k, v]) => {
      switch (k) {
        case "icons": {
          return Extractors.icons(options, base, v as any, await assets.icons);
        }
        case "assets": {
          return Extractors.images(
            options,
            base,
            v as any,
            await assets.images
          );
        }
        case "colors": {
          return Extractors.colors(options, base, v, await assets.colors);
        }
        case "typography": {
          return Extractors.typography(
            options,
            base,
            v,
            await assets.textStyles
          );
        }
      }

      console.log(`Unknown extractor: ${k}`);
    })
  );
}
