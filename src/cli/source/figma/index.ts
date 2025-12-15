import {
  type Assets,
  type Color,
  emptyAssets,
  type Icon,
  type Image,
  parseIconName,
  type TextStyle,
} from "../../shared";
import { groupBy } from "../../stdlib/groupBy";

interface Options {
  figmaToken?: string;
}

export async function loadAssets(options: Options, source: string): Promise<Assets> {
  const fetchOptions = {
    headers: {
      "X-FIGMA-TOKEN": options.figmaToken!,
    },
  };

  /*
   * Parse the source url into figma file and node id.
   */
  const { key, id } = (() => {
    const { host: key, pathname } = new URL(source);
    return { key, id: pathname.substring(1) };
  })();

  const file = fetch(`https://api.figma.com/v1/files/${key}`, fetchOptions).then((res) => res.json());

  /*
   * Fetch all direct children of the node. These are the nodes which are eligible
   * to be treated as icons or images.
   */
  const nodes = (async () => {
    const json = await fetch(`https://api.figma.com/v1/files/${key}/nodes?ids=${id}`, fetchOptions).then(
      (res) => res.json() as any,
    );
    return json.nodes[id].document.children as any[];
  })();

  const icons = async (): Promise<Array<Icon>> => {
    const ids = (await nodes).flatMap((n) => (parseIconName(n.name) ? [n.id] : []));
    if (ids.length === 0) {
      return [];
    }

    const { images } = await fetch(
      `https://api.figma.com/v1/images/${key}?ids=${ids.join(",")}&format=svg`,
      fetchOptions,
    ).then((res) => res.json() as any);

    return await Promise.all(
      Object.keys(images).map(async (k) => {
        const { name, size } = parseIconName((await nodes).find((n) => n.id === k)?.name)!;
        const src = await fetch(images[k]).then((res) => res.text());

        return { src, name, size };
      }),
    );
  };

  const images = async (): Promise<Array<Image>> => {
    const sources = (await nodes).flatMap((n: { id: string; name: string; exportSettings: any[] }) => {
      if (!n.name.match(/ic_/) && n.exportSettings) {
        return n.exportSettings.flatMap(({ format }: { format: string }) => {
          if (format === "SVG" || format === "PNG") {
            return [
              {
                id: n.id as string,
                name: n.name as string,
                format: format as "SVG" | "PNG",
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
            fetchOptions,
          ).then((res) => res.json() as any);

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
                        const res = await fetch(url);

                        return {
                          name,
                          svg: await res.text(),
                        } as Image;
                      },
                      PNG: async () => {
                        const res = await fetch(url);

                        return {
                          name,
                          buffer: Buffer.from(await res.arrayBuffer()),
                        } as Image;
                      },
                    }[format],
                  ];
                }
              })
              .map((f) => f()),
          );
        }),
      )
    ).flat();
  };

  const colors = async (): Promise<Array<Color>> => {
    const styles = ((await file) as any).styles;

    const rgbToHex = (r: number, g: number, b: number, a: number) => {
      if (a === 1) {
        return `#${((r << 16) + (g << 8) + b).toString(16).padStart(6, "0")}`;
      } else {
        return `#${((r << 24) + (g << 16) + (b << 8) + Math.round(a * 255)).toString(16).padStart(8, "0")}`;
      }
    };

    const colors: Array<Color> = [];

    (function go(nodes: any) {
      for (const node of nodes) {
        if (node.styles?.fill) {
          const style = styles[node.styles.fill];
          if (style) {
            const fill = node.fills[0];
            const { r, g, b } = fill.color;
            // console.log(style.name, fill);
            colors.push({
              name: style.name,
              color: rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), fill.opacity || 1),
            });
          }
        }

        if (node.children) {
          go(node.children);
        }
      }
    })(await nodes);

    return colors;
  };

  const textStyles = async (): Promise<Array<TextStyle>> => {
    const styles = ((await file) as any).styles;

    const textStyles: Array<TextStyle> = [];

    (function go(nodes: any) {
      for (const node of nodes) {
        if (node.styles?.text) {
          const style = styles[node.styles.text];
          if (style) {
            // console.log(style.name, node.style);
            textStyles.push({
              name: style.name,
              style: {
                fontFamily: node.style.fontFamily,
                fontWeight: node.style.fontWeight,
                fontSize: node.style.fontSize,
                letterSpacing: node.style.letterSpacing,
                lineHeightPx: node.style.lineHeightPx,
                opentypeFlags: node.style.opentypeFlags,
              },
            });
          }
        }

        if (node.children) {
          go(node.children);
        }
      }
    })(await nodes);

    return textStyles;
  };

  return {
    ...emptyAssets,

    get icons() {
      return icons();
    },

    get images() {
      return images();
    },

    get colors() {
      return colors();
    },

    get textStyles() {
      return textStyles();
    },
  };
}
