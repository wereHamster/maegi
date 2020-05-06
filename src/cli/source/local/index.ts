import * as svgr from "@svgr/core";
import * as fs from "fs";
import * as path from "path";
import { parseFilename, Assets } from "../../shared";

export async function loadAssets(source: string): Promise<Assets> {
  const options = {
    template({ template }, _, { componentName, jsx }) {
      return template.smart({ plugins: ["typescript"] })
        .ast`export const ${componentName} = React.memo<React.SVGProps<SVGSVGElement>>(props => ${jsx});`;
    },
    plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
    svgoConfig: {
      multipass: true,
      plugins: [
        { removeViewBox: false },
        { sortAttrs: true },
        { convertColors: { currentColor: true } },
        { removeAttrs: { attrs: "(xmlns.*)" } },
      ],
    },
  };

  const ids = await (async () => {
    const allFiles = await fs.promises.readdir(source);
    return allFiles.filter((icon) => icon.match(/^ic_.*\.svg$/));
  })();

  const icons = await Promise.all(
    ids.map(async (id) => {
      const { name, size } = parseFilename(id);
      const src = await fs.promises.readFile(path.join(source, id), "utf8");

      const code = (await svgr.default(src, options, {
        componentName: `${name}${size || ""}`,
      })) as string;

      return { code, src, name, size };
    })
  );

  return { icons, images: [] };
}
