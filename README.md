maegi is a commandline tool which converts a folder full of SVG icons (which follow a strict naming convention) into a folder full of React components which you can import in a React project.

It is very simular to svgr (in fact, it uses @svgr/core internally), but instead of just mapping each input SVG file into one React component, it contains a bit more logic. That however requires that the SVG files follow a specific naming convention. This tool is suited for processing SVG icons, and less suited for processing arbitrary SVGs (illustrations, images, charts etc).

Naming convention: `ic_<name>_<size>dp.svg`. The `<name>` can be an arbitrary ASCII string, and is converted into CamelCase for the corresponding React component. The `<size>` is the size of the icon in pixels. Example: `ic_arrow-down_24dp.svg`.

The tool groups icons by name, if you have multiple icons with the same name which differ only by their size.

For each group, the tool creates a folder, and places the React components in it.

It'll also create an index file which re-exports all icons, for your convenience, so you can `import * as Icons from "…/icons"`

The tool also generates a file witl all icon descriptors for [@valde/iconography](https://valde.caurea.org/#/packages/iconography).

The result is a folder which looks and behaves like a npm package. While it is not a specific goal of this tool that the output folder is published into a npm registry, you should think of the output as such.

# Example

Input

```
svg/
  ic_arrow-down_24dp.svg
  ic_arrow-down_40dp.svg
  ic_check_24dp.svg
```

Command:

```
npx @maegi/cli svg -o src/icons
```

Output:

```
src/icons/monochrome/
  index.ts         // Re-exports all icons.
  descriptors.ts   // An index of all icon descriptors for @valde/iconography.
  ArrowDown/
    index.tsx      // Contains <ArrowDown24> and <ArrowDown40>
  Check
    index.tsx      // Contains <Check24>
```

```
```
