import fetch from "node-fetch";
import { Assets, parseFilename } from "../../shared";

export async function loadAssets(source: string): Promise<Assets> {
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
      const src = await fetch(images[k]).then((res) => res.text());

      return { src, name, size };
    })
  );

  return { icons, images: [] };
}
