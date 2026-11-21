#!/usr/bin/env node
/**
 * Writes the Hugeicons (stroke rounded, the only icon set the Heliyos design system allows) the docs use to
 * icons/<name>.svg, drawn in graphite at stroke 1.5. Pages reference them as icon="/icons/<name>.svg".
 * Add an icon: put it in ICONS (docs name -> Hugeicons export, or a Heliyos glyph array) and run
 * `npm run build:icons`.
 *
 * ICONS follows the one icon registry shared by the web app, the website and these docs: one glyph per
 * concept, so every name for a concept (the app-* nav name and the generic card name) draws the same glyph.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const icons = require("@hugeicons/core-free-icons");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GRAPHITE = "#27251E";

/*
 * Glyphs drawn for Heliyos where Hugeicons has no fitting one, on the Hugeicons grid and conventions.
 * Copied from the product app's shared UI package (its icons/heliyos-glyphs module, `WorkersIcon`), the source
 * of truth. Three copies exist: the product app's, the marketing website's (its ui/heliyos-glyphs module) and
 * this one; change all three together. Paths are left out because this repository is public.
 */
// Workers: two AI teammates drawn from the clay worker avatar. The label icon for workers.
const WorkersIcon = [
  ["path", { d: "M8.5 20C8.5 14.2 10.9 10.5 14.25 10.5C17.6 10.5 20 14.2 20 20C20 20.55 19.55 21 19 21H9.5C8.95 21 8.5 20.55 8.5 20Z", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", key: "0" }],
  ["path", { d: "M14.25 10.5C14.25 9.2 14.95 8.2 16.25 7.85", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", key: "1" }],
  ["path", { d: "M12.4 15.1v.8", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", key: "2" }],
  ["path", { d: "M16.1 15.1v.8", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", key: "3" }],
  ["path", { d: "M12.85 17.9C13.65 18.6 14.85 18.6 15.65 17.9", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", key: "4" }],
  ["path", { d: "M5.75 19.5H4.5C3.95 19.5 3.5 19.05 3.5 18.5C3.5 13 5.6 9.5 8.6 9.5C9.9 9.5 11 10.1 11.85 11.2", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", key: "5" }],
  ["path", { d: "M8.6 9.5C8.6 8.3 9.2 7.35 10.35 6.95", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", key: "6" }],
];

// docs name -> a Hugeicons export name (string) or a Heliyos glyph array (above).
export const ICONS = {
  // Registry concepts. The app-* names label nav groups (the app's sidebar, settings and entity icons);
  // the generic names label cards. Both names of a concept draw the same glyph.
  "app-workers": WorkersIcon, // Workers
  worker: WorkersIcon,
  "app-scouts": "Radar01Icon", // Scouts
  scouts: "Radar01Icon",
  "app-watchlist": "Telescope01Icon", // Watchers and the watchlist
  watchers: "Telescope01Icon",
  "app-reviews": "TaskDone01Icon", // Reviews
  review: "TaskDone01Icon",
  refresh: "RefreshIcon", // Autonomous Updates, sync
  ai: "SparklesIcon", // AI marker
  "app-tasks": "CheckmarkSquare01Icon", // Tasks
  tasks: "CheckmarkSquare01Icon",
  "app-company": "Building02Icon", // Company
  company: "Building02Icon",
  "app-objects": "Layers01Icon", // Objects and records
  objects: "Layers01Icon",
  "app-notes": "Note01Icon", // Notes
  note: "Note01Icon",
  "app-inbox": "InboxIcon", // Inbox
  "app-signals": "Activity03Icon", // Signals
  "app-chat": "BubbleChatIcon", // Chat and Ask
  chat: "BubbleChatIcon",
  "app-runs": "WorkflowSquare01Icon", // Runs
  "app-knowledge": "BookOpen01Icon", // Knowledge base
  "app-file": "File01Icon", // Files
  file: "File01Icon",
  "app-teams": "UserMultiple02Icon", // Team members
  team: "UserMultiple02Icon",
  "app-usage": "ActivityCircleIcon", // Usage
  usage: "ActivityCircleIcon",
  "app-history": "Clock01Icon", // Timeline and history
  timeline: "Clock01Icon",
  "app-labels": "Tag01Icon", // Labels
  label: "Tag01Icon",
  "app-integrations": "Link01Icon", // Integrations
  link: "Link01Icon",
  "app-notifications": "Notification01Icon", // Notifications
  bell: "Notification01Icon",
  // Other app screens.
  "app-preferences": "Settings02Icon",
  "app-general": "DashboardSquare01Icon",
  "app-pages": "File02Icon",
  // Tabs and guide groups.
  "tab-guides": "BookOpen01Icon",
  "tab-api": "SourceCodeIcon",
  "tab-mcp": "PlugSocketIcon",
  "group-start": "Rocket01Icon",
  "group-recipes": "WorkflowSquare01Icon",
  "group-tools": "Wrench01Icon",
  "group-operate": "Settings02Icon",
  // Generic icons that label no registry concept.
  api: "ApiIcon",
  plug: "PlugSocketIcon",
  key: "Key01Icon",
  rocket: "Rocket01Icon",
  book: "BookOpen01Icon",
  upload: "Upload01Icon",
  shield: "Shield01Icon",
  alert: "AlertCircleIcon",
  settings: "Settings02Icon",
  terminal: "CommandLineIcon",
  code: "SourceCodeIcon",
  arrow: "ArrowRight01Icon",
  layers: "Layers01Icon",
  filter: "FilterIcon",
  clock: "Clock01Icon",
  lock: "LockKeyIcon",
};

const STROKE_WIDTH = "1.5"; // The registry's one stroke weight (Hugeicons' own; glyph arrays leave it to the renderer).
const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const attrs = (a) =>
  Object.entries(a.stroke && a.strokeWidth === undefined ? { ...a, strokeWidth: STROKE_WIDTH } : a)
    .filter(([k]) => k !== "key")
    .map(([k, v]) => `${kebab(k)}="${v === "currentColor" ? GRAPHITE : v}"`)
    .join(" ");

mkdirSync(resolve(root, "icons"), { recursive: true });
for (const [name, source] of Object.entries(ICONS)) {
  const def = Array.isArray(source) ? source : icons[source];
  if (!def) throw new Error(`build-icons: ${source} is not in @hugeicons/core-free-icons`);
  const body = def.map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join("");
  writeFileSync(
    resolve(root, "icons", `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">${body}</svg>\n`
  );
}
console.log(`build-icons: ${Object.keys(ICONS).length} icons -> icons/`);

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
