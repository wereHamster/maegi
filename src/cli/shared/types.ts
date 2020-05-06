export interface Assets {
  icons: Array<{
    /**
     * ic_(.*)_([0-9+]dp)
     */
    name: string;

    size: number;

    /**
     * The original source string.
     */
    src: string;

    /**
     * 'src' as React code.
     *
     * TODO: Remove, the Asset should not contain the compiled code.
     */
    code: string;
  }>;

  images: Array<Image>;
}

type Image = { svg: string } | { buffer: Buffer };
