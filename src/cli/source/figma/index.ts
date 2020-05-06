import fetch from "node-fetch";
import { Assets, Icon, Image, parseIconName } from "../../shared";
import { groupBy } from "../../stdlib/groupBy";

export async function loadAssets(source: string): Promise<Assets> {
  const fetchOptions = {
    headers: {
      "X-FIGMA-TOKEN": process.env.FIGMA_TOKEN,
    },
  };

  /*
   * Parse the source url into figma file and node id.
   */
  const { key, id } = (() => {
    const { host: key, pathname } = new URL(source);
    return { key, id: pathname.substring(1) };
  })();

  /*
   * Fetch all direct children of the node. These are the nodes which are eligible
   * to be treated as icons or images.
   */
  const nodes = await (async () => {
    const json = await fetch(
      `https://api.figma.com/v1/files/${key}/nodes?ids=${id}`,
      fetchOptions
    ).then((res) => res.json());
    return json.nodes[id].document.children as any[];
  })();

  const icons = await (async (): Promise<Array<Icon>> => {
    const ids = nodes.flatMap((n) => (parseIconName(n.name) ? [n.id] : []));
    if (ids.length === 0) {
      return [];
    }

    const { images } = await fetch(
      `https://api.figma.com/v1/images/${key}?ids=${ids.join(",")}&format=svg`,
      fetchOptions
    ).then((res) => res.json());

    return await Promise.all(
      Object.keys(images).map(async (k) => {
        const { name, size } = parseIconName(
          nodes.find((n) => n.id === k)!.name
        );
        const src = await fetch(images[k]).then((res) => res.text());

        return { src, name, size };
      })
    );
  })();

  const images = await (async (): Promise<Array<Image>> => {
    const sources = nodes.flatMap((n) => {
      if (!n.name.match(/ic_/) && n.exportSettings) {
        return n.exportSettings.flatMap(({ format }) => {
          if (format === "SVG" || format === "PNG") {
            return [
              {
                id: n.id,
                name: n.name,
                format,
              },
            ];
          } else {
            return [];
          }
        });
      } else {
        return [];
      }
    });

    if (sources.length === 0) {
      return [];
    }

    const groups = groupBy((s) => s.format, sources);

    return (
      await Promise.all(
        [...groups.entries()].map(async ([format, sources]) => {
          const scale = { SVG: 1, PNG: 2 }[format];
          const ids = sources.map((s) => s.id).join(",");
          const { images } = await fetch(
            `https://api.figma.com/v1/images/${key}?ids=${ids}&format=${format.toLowerCase()}&scale=${scale}`,
            fetchOptions
          ).then((res) => res.json());

          return Promise.all(
            sources
              .flatMap(({ id, name }) => {
                const url = images[id];
                if (!url) {
                  return [];
                } else {
                  return [
                    {
                      SVG: async () => {
                        return {
                          name,
                          svg: await fetch(url).then((res) => res.text()),
                        };
                      },
                      PNG: async () => {
                        return {
                          name,
                          buffer: Buffer.from(
                            await fetch(url).then((res) => res.arrayBuffer())
                          ),
                        };
                      },
                    }[format],
                  ];
                }
              })
              .map((f) => f())
          );
        })
      )
    ).flat();
  })();

  return { icons, images };
}
