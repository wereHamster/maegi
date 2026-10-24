import * as t from "io-ts";

export const Source = t.type({
  source: t.string,
  extractors: t.record(t.string, t.unknown),
});
export type Source = t.TypeOf<typeof Source>;

export const Config = t.type({
  apiVersion: t.literal("v1"),
  sources: t.array(Source),
});
export type Config = t.TypeOf<typeof Config>;
