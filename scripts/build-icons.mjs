#!/usr/bin/env node
/**
 * Writes the Hugeicons (stroke rounded, the only icon set the Heliyos design system allows) the docs use to
 * icons/<name>.svg, drawn in graphite. Pages reference them as icon="/icons/<name>.svg".
 * Add an icon: put it in ICONS (docs name -> Hugeicons export) and run `npm run build:icons`.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const icons = require("@hugeicons/core-free-icons");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GRAPHITE = "#27251E";

export const ICONS = {
  // The app's own icons (sidebar, settings and entity icons), so docs groups match the product.
  "app-objects": "Layers01Icon",
  "app-company": "Building02Icon",
  "app-tasks": "CheckmarkSquare01Icon",
  "app-notes": "Note01Icon",
  "app-workers": "UserGroupIcon",
  "app-scouts": "Mortarboard01Icon",
  "app-watchlist": "Telescope01Icon",
  "app-labels": "Tag01Icon",
  "app-teams": "UserMultiple02Icon",
  "app-notifications": "Notification01Icon",
  "app-preferences": "Settings02Icon",
  "app-usage": "ActivityCircleIcon",
  "app-general": "DashboardSquare01Icon",
  "app-history": "Clock01Icon",
  "app-chat": "BubbleChatIcon",
  "app-file": "File01Icon",
  "app-knowledge": "BookOpen01Icon",
  "app-pages": "File02Icon",
  "app-runs": "WorkflowSquare01Icon",
  "app-signals": "SearchCheckIcon",
  "app-inbox": "InboxIcon",
  "app-integrations": "Link01Icon",
  // Tabs and guide groups.
  "tab-guides": "BookOpen01Icon",
  "tab-api": "SourceCodeIcon",
  "tab-mcp": "PlugSocketIcon",
  "group-start": "Rocket01Icon",
  "group-recipes": "WorkflowSquare01Icon",
  "group-tools": "Wrench01Icon",
  "group-operate": "Settings02Icon",
  api: "ApiIcon",
  plug: "PlugSocketIcon",
  refresh: "RefreshIcon",
  note: "Note01Icon",
  worker: "AiBrain01Icon",
  scouts: "Radar01Icon",
  watchers: "Telescope01Icon",
  timeline: "TimelineIcon",
  objects: "Database01Icon",
  key: "Key01Icon",
  rocket: "Rocket01Icon",
  book: "BookOpen01Icon",
  review: "TaskDone01Icon",
  upload: "Upload01Icon",
  file: "File01Icon",
  shield: "Shield01Icon",
  alert: "AlertCircleIcon",
  settings: "Settings02Icon",
  terminal: "CommandLineIcon",
  code: "SourceCodeIcon",
  arrow: "ArrowRight01Icon",
  layers: "Layers01Icon",
  team: "UserGroupIcon",
  label: "Tag01Icon",
  bell: "Notification01Icon",
  usage: "ChartLineData01Icon",
  filter: "FilterIcon",
  clock: "Clock01Icon",
  tasks: "CheckListIcon",
  chat: "BubbleChatIcon",
  ai: "SparklesIcon",
  company: "Building03Icon",
  link: "Link01Icon",
  lock: "LockKeyIcon",
};

const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const attrs = (a) =>
  Object.entries(a)
    .filter(([k]) => k !== "key")
    .map(([k, v]) => `${kebab(k)}="${v === "currentColor" ? GRAPHITE : v}"`)
    .join(" ");

mkdirSync(resolve(root, "icons"), { recursive: true });
for (const [name, exportName] of Object.entries(ICONS)) {
  const def = icons[exportName];
  if (!def) throw new Error(`build-icons: ${exportName} is not in @hugeicons/core-free-icons`);
  const body = def.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join("");
  writeFileSync(
    resolve(root, "icons", `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">${body}</svg>\n`
  );
}
console.log(`build-icons: ${Object.keys(ICONS).length} Hugeicons -> icons/`);

// ------------------------------------------------------------------ client logos
// Logos of the AI clients on the MCP install page, in their brand colours, from open icon
// packages: Simple Icons (CC0) and devicon (MIT). Brand names and marks belong to their owners.
const si = require("simple-icons");
const siV13 = require("simple-icons-v13"); // the last release that still ships the OpenAI mark
const fromSimpleIcons = (icon, hex) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="${icon.title}"><path fill="#${hex ?? icon.hex}" d="${icon.path}"/></svg>\n`;
const LOGOS = {
  claude: fromSimpleIcons(si.siClaude),
  openai: fromSimpleIcons(siV13.siOpenai, "0F0F0F"),
  cursor: fromSimpleIcons(si.siCursor, "0F0F0F"),
  google: fromSimpleIcons(si.siGoogle),
  vscode: readFileSync(require.resolve("devicon/icons/vscode/vscode-original.svg"), "utf8"),
};
mkdirSync(resolve(root, "logos"), { recursive: true });
for (const [name, svg] of Object.entries(LOGOS)) writeFileSync(resolve(root, "logos", `${name}.svg`), svg);
console.log(`build-icons: ${Object.keys(LOGOS).length} client logos -> logos/`);
