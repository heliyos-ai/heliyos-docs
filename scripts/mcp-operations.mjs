/**
 * Which Heliyos API operations the MCP server calls, and from which tools.
 *
 * Source of truth is the heliyos-mcp source: every `callOperation(client, "<operationId>"`
 * inside a tool block. Tool names come from `name: "heliyos_..."`. Helpers declared before the
 * first tool in a file (shared lookups such as listRoles in teams.ts) are attributed to every
 * tool in that file that calls the helper, so they are reported under the file's tools too.
 *
 * Experimental tools are the ones in tests/__snapshots__/tools.experimental.json and not in
 * tests/__snapshots__/tools.json.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const CALL = /callOperation\(\s*client,\s*"([A-Za-z]+)"/g;
const TOOL = /name:\s*"(heliyos_[a-z0-9_]+)"/g;

const namesIn = (file) =>
  existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).map((t) => t.name) : [];

/** @returns {{ operations: Map<string, Set<string>>, experimentalTools: Set<string>, tools: string[] }} */
export function scanMcpOperations(mcpRoot) {
  const toolsDir = resolve(mcpRoot, "src/tools");
  if (!existsSync(toolsDir)) throw new Error(`mcp-operations: ${toolsDir} not found`);
  const operations = new Map();
  const add = (op, tool) => {
    if (!operations.has(op)) operations.set(op, new Set());
    operations.get(op).add(tool);
  };
  const allTools = [];
  for (const file of readdirSync(toolsDir).filter((f) => f.endsWith(".ts")).sort()) {
    const src = readFileSync(resolve(toolsDir, file), "utf8");
    const marks = [...src.matchAll(TOOL)].map((m) => ({ name: m[1], at: m.index }));
    const calls = [...src.matchAll(CALL)].map((m) => ({ op: m[1], at: m.index }));
    if (marks.length === 0) {
      // A helper-only file (baseSchemas.ts): its calls belong to whichever tools use it,
      // which is every record/object tool; attribute them to a synthetic owner.
      for (const c of calls) add(c.op, `(shared helper in ${file})`);
      continue;
    }
    allTools.push(...marks.map((m) => m.name));
    for (const c of calls) {
      // The tool whose `name:` precedes the call owns it. Calls before the first tool are
      // file-level helpers shared by the file's tools.
      const owner = [...marks].reverse().find((m) => m.at < c.at);
      if (owner) add(c.op, owner.name);
      else for (const m of marks) add(c.op, m.name);
    }
  }
  const stable = new Set(namesIn(resolve(mcpRoot, "tests/__snapshots__/tools.json")));
  const experimental = namesIn(resolve(mcpRoot, "tests/__snapshots__/tools.experimental.json"));
  const experimentalTools = new Set(experimental.filter((n) => !stable.has(n)));
  return { operations, experimentalTools, tools: allTools };
}
