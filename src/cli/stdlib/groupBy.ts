export const groupBy = <T, K>(f: (x: T) => K, xs: T[]): Map<K, T[]> => {
  const m = new Map<K, T[]>();

  const l = xs.length;
  for (let i = 0; i < l; ++i) {
    const x = xs[i];
    const k = f(x);
    const g = m.get(k);
    if (g === undefined) {
      m.set(k, [x]);
    } else {
      g.push(x);
    }
  }

  return m;
};
