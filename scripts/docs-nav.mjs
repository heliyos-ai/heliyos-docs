/**
 * Writes generated navigation groups into docs.json. Each generated group carries
 * `"generated": "<source>"` so a rebuild replaces exactly the groups it owns and keeps the
 * hand-written ones (Overview, Get started, Operate) where they are.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { root } from "./env.mjs";

/**
 * Replaces the groups marked `generated: source` in the tab named `tab` with `groups`, at the
 * position of the first one (or after `after` when there are none yet).
 */
export function setGeneratedGroups({ tab, source, groups, after }) {
  const file = resolve(root, "docs.json");
  const docs = JSON.parse(readFileSync(file, "utf8"));
  const t = docs.navigation?.tabs?.find((x) => x.tab === tab);
  if (!t) throw new Error(`docs-nav: no tab "${tab}" in docs.json`);
  const marked = groups.map((g) => ({ ...g, generated: source }));
  const first = t.groups.findIndex((g) => g.generated === source || g.$ref);
  const kept = t.groups.filter((g) => g.generated !== source && !g.$ref);
  let at = first >= 0 ? first : kept.findIndex((g) => g.group === after) + 1;
  if (at < 0) at = kept.length;
  t.groups = [...kept.slice(0, at), ...marked, ...kept.slice(at)];
  writeFileSync(file, JSON.stringify(docs, null, 2) + "\n");
}
