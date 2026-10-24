export const groupBy = <T, K>(f: (x: T) => K, xs: Iterable<T>): Map<K, T[]> => {
  const m = new Map<K, T[]>();

  for (const x of xs) {
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
