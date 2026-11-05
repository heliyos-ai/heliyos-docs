/**
 * The MCP tool groups, read from the generated tool table in heliyos-mcp/README.md
 * (between `<!-- tools:start` and `<!-- tools:end -->`, written by scripts/tool-table.mjs there).
 * One group per `#### Heading`, in README order, so the docs group tools exactly as the
 * package README does.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** @returns {{ title: string, slug: string, tools: string[] }[]} */
export function readMcpGroups(mcpRoot) {
  const readme = readFileSync(resolve(mcpRoot, "README.md"), "utf8");
  const start = readme.indexOf("<!-- tools:start");
  const end = readme.indexOf("<!-- tools:end");
  if (start < 0 || end < 0) throw new Error("mcp-groups: tool table markers not found in heliyos-mcp/README.md");
  const groups = [];
  for (const line of readme.slice(start, end).split("\n")) {
    const heading = line.match(/^####\s+(.+)$/);
    if (heading) {
      groups.push({ title: heading[1].trim(), slug: slugify(heading[1]), tools: [] });
      continue;
    }
    const row = line.match(/^\|\s*`(heliyos_[a-z0-9_]+)`/);
    if (row && groups.length) groups[groups.length - 1].tools.push(row[1]);
  }
  if (groups.length === 0) throw new Error("mcp-groups: no tool groups found in heliyos-mcp/README.md");
  return groups;
}
