Maegi is a commandline tool that prepares design assets for use in a React project. It currently supports two kinds of sources for these assets: The local filesystem and Figma.

## Usage

First you need to create a config file. The file describes what you want to extract from where.

The following file defines one source that reads from the local filesystem and generates icons from all SVG files:

```
apiVersion: v1
sources:
  - source: local:folder/with/svg/files/
    extractors:
      icons:
        output: src/icons/
```

Point the `@maegi/cli` tool to the config file and profit:

```
npx @maegi/cli path/to/config.yml
```

## Extractors

Extractors describe what to extract from the source.

Maegi supports the following extractors:

- **colors**
- **icons**: SVGs which follow a specific naming convention are converted to React components.
- **assets**: Images marked in Figma as exports are downloaded and saved as SVG or lossless webp.

Not all extractors work with all sources. For example, the `local:` source supports only `icons`.

### colors

The `colors` extractors generates a JavaScript file which exports all color styles.

### icons

The icons extractor generates TypeScript files which export the icons as React components.

The naming convention for icons is `ic_<name>_<size>dp`. The `<name>` can be an arbitrary ASCII string, and is converted into CamelCase for the corresponding React component. The `<size>` is the size of the icon in pixels. Example: `ic_arrow-right_24dp.svg`. Inside Figma the icons can have arbitrary prefix (eg. `icons/24dp/ic_arrow-right_24dp`).

When generating the JavaScript modules with the React components, the icons are grouped by name and one module is writen per name. For example, `src/icons/ArrowRight.tsx` may contain `<ArrowRight16>`, `<ArrowRight24>`, and `<ArrowRight64>` components.

Maegi also creates an index file which re-exports all icons, for your convenience, so you can `import * as Icons from "src/icons"`.

### assets

Images marked for export in Figma are downloaded and placed into the output folder. Both SVG and PNG format is supported.

PNG images are converted to lossless webp to save space.
