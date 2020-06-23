export interface Assets {
  icons: Promise<Array<Icon>>;
  images: Promise<Array<Image>>;
  colors: Promise<Array<Color>>;
}

export const emptyAssets: Assets = {
  icons: Promise.resolve([]),
  images: Promise.resolve([]),
  colors: Promise.resolve([]),
};

export interface Icon {
  /**
   * ic_(.*)_([0-9+]dp)
   */
  name: string;

  size: number;

  /**
   * The original source string.
   */
  src: string;
}

export type Image =
  | { name: string; svg: string }
  | { name: string; buffer: Buffer };

export interface Color {
  name: string;
  color: string;
}
