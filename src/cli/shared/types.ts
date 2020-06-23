export interface Assets {
  icons: Array<Icon>;
  images: Array<Image>;
  colors: Array<Color>;
}

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
