/**
 * Writes llms.txt, the index AI assistants and agents read to discover these docs
 * (https://llmstxt.org). A root llms.txt replaces the one the docs host would generate, so this
 * script keeps it complete: the key facts block, then every page in docs.json navigation order,
 * with every API endpoint and every MCP tool page. Links point at the Markdown version of each
 * page (`.md`), which carries the full text and, for endpoints, the OpenAPI definition.
 *
 *   node scripts/build-llms.mjs          write llms.txt
 *   node scripts/build-llms.mjs --check  fail when llms.txt is out of date
 *
 * llms-full.txt is left to the docs host, which generates it from every page.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { root } from "./env.mjs";

const SITE = "https://docs.heliyos.ai";
const CHECK = process.argv.includes("--check");

const docs = JSON.parse(readFileSync(resolve(root, "docs.json"), "utf8"));
const spec = JSON.parse(readFileSync(resolve(root, "api-reference/openapi.json"), "utf8"));
const facts = readFileSync(resolve(root, "scripts/llms-header.md"), "utf8").trim();

const errors = [];

/** Frontmatter of an MDX page. */
function frontmatter(page) {
  const file = resolve(root, `${page}.mdx`);
  if (!existsSync(file)) {
    errors.push(`${page}: in docs.json navigation but ${page}.mdx does not exist`);
    return {};
  }
  const m = readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/);
  return m ? yaml.load(m[1]) ?? {} : {};
}

/** The first sentence of a Markdown description, on one line. */
function firstSentence(text = "") {
  const flat = text.replace(/\s+/g, " ").replace(/\*\*/g, "").trim();
  const m = flat.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : flat).trim();
}

const url = (path) => `${SITE}/${path === "index" ? "index" : path}.md`;

/** "METHOD /path" navigation entries -> the operation in the built spec. */
function operation(entry) {
  const [method, path] = entry.split(" ");
  const op = spec.paths?.[path]?.[method.toLowerCase()];
  if (!op) errors.push(`${entry}: in docs.json navigation but not in api-reference/openapi.json`);
  return op && { method, path, op };
}

function pageLine(page) {
  const fm = frontmatter(page);
  const title = fm.title ?? page;
  if (!fm.description) errors.push(`${page}: no description in frontmatter`);
  return `- [${title}](${url(page)}): ${fm.description ?? ""}`.trimEnd();
}

function operationLine(entry) {
  const o = operation(entry);
  if (!o) return null;
  const href = o.op["x-mint"]?.href;
  if (!href) {
    errors.push(`${entry}: no x-mint.href in api-reference/openapi.json`);
    return null;
  }
  return `- [${o.op.summary}](${SITE}${href}.md): \`${o.method} ${o.path}\`. ${firstSentence(o.op.description)}`;
}

const sections = [];
for (const tab of docs.navigation.tabs) {
  for (const group of tab.groups ?? []) {
    const lines = (group.pages ?? [])
      .map((p) => (typeof p !== "string" ? null : /^(GET|POST|PUT|PATCH|DELETE) \//.test(p) ? operationLine(p) : pageLine(p)))
      .filter(Boolean);
    if (!lines.length) continue;
    const heading = group.group === tab.tab || tab.tab === "Guides" ? group.group : `${tab.tab}: ${group.group}`;
    sections.push(`## ${heading}\n\n${lines.join("\n")}`);
  }
}

const out = `${facts}\n\n${sections.join("\n\n")}\n\n## Optional\n\n- [Full text of every page](${SITE}/llms-full.txt): every page of these docs in one Markdown file.\n- [Heliyos website summary](https://www.heliyos.ai/llms.txt): the product, its features, integrations, pricing and comparisons.\n- [MCP server on npm](https://www.npmjs.com/package/@heliyos/heliyos-mcp): the \`@heliyos/heliyos-mcp\` package.\n- [MCP server source](https://github.com/heliyos-ai/heliyos-mcp): the MCP server's code and README.\n`;

if (errors.length) {
  console.error(`build-llms: ${errors.length} problem(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}

const file = resolve(root, "llms.txt");
if (CHECK) {
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (current !== out) {
    console.error("build-llms: llms.txt is out of date. Run npm run build:llms.");
    process.exit(1);
  }
  console.log("build-llms: llms.txt is current (check only)");
} else {
  writeFileSync(file, out);
  const links = (out.match(/^- \[/gm) ?? []).length;
  console.log(`build-llms: ${links} links in ${sections.length} sections -> llms.txt`);
}
