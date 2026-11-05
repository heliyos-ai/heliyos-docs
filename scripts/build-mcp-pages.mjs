#!/usr/bin/env node
/**
 * Generates the MCP tool reference: one page per tool group (mcp/tools/<group>.mdx) and the
 * sidebar group (mcp/navigation.json), from what an MCP client really sees.
 *
 *   data/mcp-tools.json      tools/list from the built server (scripts/dump-mcp-tools.mjs)
 *   heliyos-mcp/README.md    tool groups and order (its generated tool table)
 *   heliyos-mcp/src/tools    which API operations each tool calls (scripts/mcp-operations.mjs)
 *   data/api-operations.json the API reference URL of each operation (scripts/build-openapi.mjs)
 *
 * Fails when a tool from tools/list is in no README group or a README tool is not served.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readMcpGroups } from "./mcp-groups.mjs";
import { scanMcpOperations } from "./mcp-operations.mjs";
import { setGeneratedGroups } from "./docs-nav.mjs";

import { root, requireEnv } from "./env.mjs";
const mcpRoot = requireEnv("HELIYOS_MCP_ROOT");
import yaml from "js-yaml";
const unpublishedTools = new Set(
  yaml.load(readFileSync(resolve(root, "overlay/_unpublished.yaml"), "utf8"))?.unpublished?.tools ?? []
);
const rawDump = JSON.parse(readFileSync(resolve(root, "data/mcp-tools.json"), "utf8"));
/** The served tools minus the ones not offered in production (overlay/_unpublished.yaml). */
const dump = { ...rawDump, tools: rawDump.tools.filter((t) => !unpublishedTools.has(t.name)) };
const apiOps = JSON.parse(readFileSync(resolve(root, "data/api-operations.json"), "utf8"));
const groups = readMcpGroups(mcpRoot)
  .map((g) => ({ ...g, tools: g.tools.filter((t) => !unpublishedTools.has(t)) }))
  .filter((g) => g.tools.length > 0);
const { operations, experimentalTools } = scanMcpOperations(mcpRoot);

/** MCP tool group -> the app icon for that area. */
const MCP_GROUP_ICONS = {
  records: "app-company",
  "timeline-and-activity": "app-history",
  "workspace-objects-and-fields": "app-objects",
  notes: "app-notes",
  tasks: "app-tasks",
  "scouts-and-signals": "app-scouts",
  "ask-runs-and-reviews": "app-chat",
  "workers-triggers-and-tools": "app-workers",
  "knowledge-base-and-files": "app-knowledge",
  watchlist: "app-watchlist",
  labels: "app-labels",
  team: "app-teams",
  "notification-settings": "app-preferences",
  usage: "app-usage",
};

const errors = [];
const byName = new Map(dump.tools.map((t) => [t.name, t]));
const grouped = new Set(groups.flatMap((g) => g.tools));
for (const t of dump.tools) if (!grouped.has(t.name)) errors.push(`${t.name}: served but in no README tool group`);
for (const name of grouped) if (!byName.has(name)) errors.push(`${name}: in the README but not served by the built server`);

/** Operations each tool calls, as API reference links. */
const opsOf = (tool) =>
  [...operations.entries()]
    .filter(([, tools]) => tools.has(tool))
    .map(([opId]) => apiOps[opId])
    .filter(Boolean);

// ------------------------------------------------------------------ MDX helpers

/** Escape MDX-significant characters outside `code spans`. */
function md(text = "") {
  return String(text)
    .split(/(`[^`]*`)/g)
    .map((part) => (part.startsWith("`") ? part : part.replace(/[{}]/g, (c) => `\\${c}`).replace(/</g, "&lt;").replace(/>/g, "&gt;")))
    .join("");
}
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function typeOf(s) {
  if (!s) return "any";
  if (s.enum) return s.type ?? "string";
  if (s.type === "array") return `${typeOf(s.items)}[]`;
  if (s.type) return Array.isArray(s.type) ? s.type.join(" | ") : s.type;
  const alts = s.anyOf ?? s.oneOf;
  if (alts) return [...new Set(alts.map(typeOf))].join(" | ");
  return "any";
}

function constraints(s) {
  const out = [];
  if (!s) return out;
  if (s.enum) out.push(`One of ${s.enum.map((v) => `\`${v}\``).join(", ")}.`);
  if (s.minimum !== undefined && s.maximum !== undefined) out.push(`From ${s.minimum} to ${s.maximum}.`);
  else if (s.minimum !== undefined) out.push(`At least ${s.minimum}.`);
  else if (s.maximum !== undefined) out.push(`At most ${s.maximum}.`);
  if (s.maxLength !== undefined) out.push(`Up to ${s.maxLength} characters.`);
  if (s.maxItems !== undefined) out.push(`Up to ${s.maxItems} items.`);
  if (s.pattern === "^[0-9a-fA-F]{24}$") out.push("A 24-character hex id.");
  if (s.format === "date-time") out.push("An ISO 8601 date-time.");
  return out;
}

function paramField(name, s, required, depth) {
  const pad = "  ".repeat(depth);
  const def = s.default !== undefined ? ` default="${attr(JSON.stringify(s.default).replace(/^"|"$/g, ""))}"` : "";
  const lines = [`${pad}<ParamField path="${attr(name)}" type="${attr(typeOf(s))}"${required ? " required" : ""}${def}>`];
  const text = [s.description, ...constraints(s)].filter(Boolean).join(" ");
  if (text) lines.push(`${pad}  ${md(text)}`);
  const objectSchema = s.type === "array" ? s.items : s;
  if (objectSchema?.type === "object" && objectSchema.properties) {
    lines.push(`${pad}  <Expandable title="${s.type === "array" ? "item properties" : "properties"}">`);
    const req = new Set(objectSchema.required ?? []);
    for (const [k, v] of Object.entries(objectSchema.properties)) lines.push(paramField(k, v, req.has(k), depth + 2));
    lines.push(`${pad}  </Expandable>`);
  }
  lines.push(`${pad}</ParamField>`);
  return lines.join("\n");
}

function kindOf(t) {
  const a = t.annotations ?? {};
  if (a.readOnlyHint) return { label: "Read", note: "Reads data. Changes nothing." };
  if (a.destructiveHint) return { label: "Destructive", note: "Deletes, removes or acts. Your client should ask you to confirm." };
  return { label: "Write", note: "Creates or updates data." };
}

const anchor = (name) => name.replace(/_/g, "-");

function toolSection(t) {
  const kind = kindOf(t);
  const experimental = experimentalTools.has(t.name);
  const out = [];
  out.push(`<div id="${anchor(t.name)}" />`, "", `## ${t.title}`, "");
  out.push(
    `\`${t.name}\` · **${kind.label}**${t.annotations?.idempotentHint ? " · Idempotent" : ""}${experimental ? " · **Beta**, needs `HELIYOS_MCP_EXPERIMENTAL=1`" : ""}`,
    ""
  );
  out.push(md(t.description), "");
  const props = t.inputSchema?.properties ?? {};
  const req = new Set(t.inputSchema?.required ?? []);
  if (Object.keys(props).length) {
    out.push("### Inputs", "");
    for (const [k, v] of Object.entries(props)) out.push(paramField(k, v, req.has(k), 0), "");
  } else {
    out.push("This tool takes no inputs.", "");
  }
  const outProps = Object.keys(t.outputSchema?.properties ?? {});
  if (outProps.length) {
    out.push(
      "### Returns",
      "",
      `A readable text summary, plus \`structuredContent\` with ${outProps.map((k) => `\`${k}\``).join(", ")}.`,
      ""
    );
  }
  const ops = opsOf(t.name);
  if (ops.length) {
    out.push("### API endpoints", "", ...ops.map((o) => `- [${o.summary}](${o.href}) · \`${o.method} ${o.path}\``), "");
  }
  if (experimental) out.push("<Warning>Beta. This tool may change or be removed without notice.</Warning>", "");
  return out.join("\n");
}

// ------------------------------------------------------------------ write

const outDir = resolve(root, "mcp/tools");
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith(".mdx")) unlinkSync(resolve(outDir, f));

for (const g of groups) {
  const tools = g.tools.map((n) => byName.get(n)).filter(Boolean);
  const reads = tools.filter((t) => t.annotations?.readOnlyHint).length;
  const page = [
    "---",
    `title: "${g.title}"`,
    `description: "${tools.length} tool${tools.length === 1 ? "" : "s"}: ${tools.map((t) => t.name).join(", ")}."`,
    `sidebarTitle: "${g.title}"`,
    `icon: "/icons/${MCP_GROUP_ICONS[g.slug] ?? "app-objects"}.svg"`,
    "---",
    "",
    "{/* Generated by scripts/build-mcp-pages.mjs from the MCP server's tools/list. Do not edit. */}",
    "",
    `| Tool | What it does | Kind |`,
    `| --- | --- | --- |`,
    ...tools.map((t) => `| [\`${t.name}\`](#${anchor(t.name)}) | ${md(t.title)}${experimentalTools.has(t.name) ? " (Beta)" : ""} | ${kindOf(t).label} |`),
    "",
    reads === tools.length ? "Every tool on this page only reads." : "Write and destructive tools change your workspace. Clients that support it ask before they run.",
    "",
    ...tools.map(toolSection),
  ].join("\n");
  writeFileSync(resolve(outDir, `${g.slug}.mdx`), page);
}

setGeneratedGroups({
  tab: "MCP server",
  source: "mcp-tools",
  groups: [{ group: "Tools", icon: "/icons/group-tools.svg", pages: ["mcp/tools/index", ...groups.map((g) => `mcp/tools/${g.slug}`)] }],
  after: "Get started",
});

// The tools index: every tool on one page, grouped.
const index = [
  "---",
  'title: "Tool reference"',
  `description: "All ${dump.tools.length} tools the Heliyos MCP server offers, by group."`,
  'sidebarTitle: "All tools"',
  'icon: "/icons/layers.svg"',
  "---",
  "",
  "{/* Generated by scripts/build-mcp-pages.mjs. Do not edit. */}",
  "",
  `The server offers ${dump.tools.length} tools. Every tool is named \`heliyos_<resource>_<verb>\` and says whether it reads, writes or is destructive, so your client can ask before it changes anything. Reads take \`response_format\` (\`concise\` or \`detailed\`), and lists take \`limit\` and \`cursor\`.`,
  "",
  ...groups.flatMap((g) => [
    `## ${g.title}`,
    "",
    "| Tool | What it does | Kind |",
    "| --- | --- | --- |",
    ...g.tools
      .map((n) => byName.get(n))
      .filter(Boolean)
      .map((t) => `| [\`${t.name}\`](/mcp/tools/${g.slug}#${anchor(t.name)}) | ${md(t.title)}${experimentalTools.has(t.name) ? " (Beta)" : ""} | ${kindOf(t).label} |`),
    "",
  ]),
].join("\n");
writeFileSync(resolve(outDir, "index.mdx"), index);

// Prompts and resources, from prompts/list and resources/templates/list.
const promptsPage = [
  "---",
  'title: "Prompts and resources"',
  'description: "Ready-made prompts and the record resource the MCP server offers."',
  "---",
  "",
  "{/* Generated by scripts/build-mcp-pages.mjs from prompts/list and resources/templates/list. Do not edit. */}",
  "",
  `Besides tools, the server offers ${dump.prompts.length} prompts and ${dump.resourceTemplates.length} resource template${dump.resourceTemplates.length === 1 ? "" : "s"}. Clients show prompts in their prompt or slash-command menu, and let you attach resources to a conversation without a tool call.`,
  "",
  "## Prompts",
  "",
  ...dump.prompts.flatMap((p) => [
    `### ${md(p.title ?? p.name)}`,
    "",
    `\`${p.name}\``,
    "",
    md(p.description),
    "",
    ...(p.arguments?.length
      ? p.arguments.map((a) => `<ParamField path="${attr(a.name)}" type="string"${a.required ? " required" : ""}>\n  ${md(a.description)}\n</ParamField>\n`)
      : ["This prompt takes no arguments.", ""]),
  ]),
  "## Resources",
  "",
  ...dump.resourceTemplates.flatMap((r) => [`### ${md(r.title ?? r.name)}`, "", `\`${r.uriTemplate}\` · \`${r.mimeType ?? "application/json"}\``, "", md(r.description), ""]),
].join("\n");
writeFileSync(resolve(root, "mcp/prompts-and-resources.mdx"), promptsPage);

if (errors.length) {
  console.error(`build-mcp-pages: ${errors.length} problem(s)\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`build-mcp-pages: ${dump.tools.length} tools on ${groups.length} pages -> mcp/tools/`);
