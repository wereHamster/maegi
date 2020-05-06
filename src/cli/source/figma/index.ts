import * as svgr from "@svgr/core";
import fetch from "node-fetch";
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

  const fetchOptions = {
    headers: {
      "X-FIGMA-TOKEN": process.env.FIGMA_TOKEN,
    },
  };

  const { key, id } = (() => {
    const { host: key, pathname } = new URL(source);
    return { key, id: pathname.substring(1) };
  })();

  const nodes = await (async () => {
    const json = await fetch(
      `https://api.figma.com/v1/files/${key}/nodes?ids=${id}`,
      fetchOptions
    ).then((res) => res.json());

    return json.nodes[id].document.children
      .map((node) => ({
        id: node.id,
        name: node.name,
      }))
      .filter((n) => n.name.match(/ic_/));
  })();

  if (nodes.length === 0) {
    console.log("");
    console.log("No icons found on the page");
    process.exit(1);
  }

  const ids = nodes.map((n) => n.id);
  const { images } = await fetch(
    `https://api.figma.com/v1/images/${key}?ids=${ids.join(",")}&format=svg`,
    fetchOptions
  ).then((res) => res.json());

  const icons = await Promise.all(
    Object.keys(images).map(async (k) => {
      const { name, size } = parseFilename(nodes.find((n) => n.id === k)!.name);

      const url = images[k];
      const src = await fetch(url).then((res) => res.text());

      const code = (await svgr.default(src, options, {
        componentName: `${name}${size || ""}`,
      })) as string;

      return { code, src, name, size };
    })
  );

  return { icons, images: [] };
}
