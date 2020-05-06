
Maegi is a commandline tool that prepares design assets for use in a React project. It currently supports two kinds of sources for these assets: The local filesystem and Figma.

## Usage

Source is local filesystem:

```
npx @maegi/cli source/folder/with/svgfiles
```

Source is Figma (file: UGrPhqJowS8w5IkcsaxKYo, id 36:1 inside that page)

```
FIGMA_TOKEN=XXX npx @maegi/cli figma://UGrPhqJowS8w5IkcsaxKYo/36:2
```

Commandline option:

 - `--icons <dir>`: Folder to which to write out the React icons (default: `src/icons`).
 - `--images <dir>`: Folder to which to write out the images (default: `assets`).

Maegi generates the following assets:

 - Icons: SVGs which follow a specific naming convention are converted to React components.
 - Images: Images marked in Figma as exports are downloaded and saved as SVG or lossless webp.

## Icons

The naming convention for icons is `ic_<name>_<size>dp`. The `<name>` can be an arbitrary ASCII string, and is converted into CamelCase for the corresponding React component. The `<size>` is the size of the icon in pixels. Example: `ic_arrow-right_24dp.svg`. Inside Figma the icons can have arbitrary prefix (eg. `icons/24dp/ic_arrow-right_24dp`).

When generating the JavaScript modules with the React components, the icons are grouped by name and one module is writen per name. For example, `src/icons/ArrowRight.tsx` may contain `<ArrowRight16>`, `<ArrowRight24>`, and `<ArrowRight64>` components.

Maegi also creates an index file which re-exports all icons, for your convenience, so you can `import * as Icons from "src/icons"`.

## Images

Images marked for export in Figma are downloaded and placed into the output folder. Both SVG and PNG format is supported.

PNG images are converted to lossless webp to save space.
