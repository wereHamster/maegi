export interface Assets {
  icons: Array<Icon>;
  images: Array<Image>;
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

type Image = { svg: string } | { buffer: Buffer };
