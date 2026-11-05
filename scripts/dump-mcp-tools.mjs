#!/usr/bin/env node
/**
 * Starts the built Heliyos MCP server over stdio (experimental tools on, a dummy key, no
 * network: tools/list never calls the API) and writes what an MCP client sees from
 * tools/list, prompts/list and resources/templates/list to data/mcp-tools.json.
 *
 * Usage: node scripts/dump-mcp-tools.mjs   (HELIYOS_MCP_ROOT: a built heliyos-mcp checkout)
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { root, requireEnv } from "./env.mjs";
const mcpRoot = requireEnv("HELIYOS_MCP_ROOT");
const bin = resolve(mcpRoot, "dist/src/bin/stdio.js");

const child = spawn(process.execPath, [bin], {
  env: {
    PATH: process.env.PATH,
    HELIYOS_API_KEY: "heliyos_docs_dump_not_a_real_key_000000000000",
    HELIYOS_MCP_EXPERIMENTAL: "1",
  },
  stdio: ["pipe", "pipe", "inherit"],
});

let buf = "";
const pending = new Map();
child.stdout.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(JSON.stringify(msg.error))) : ok(msg.result);
    }
  }
});

let nextId = 1;
const rpc = (method, params = {}) =>
  new Promise((ok, fail) => {
    const id = nextId++;
    pending.set(id, { ok, fail });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });

const timer = setTimeout(() => {
  console.error("dump-mcp-tools: timed out waiting for the server");
  child.kill();
  process.exit(1);
}, 20000);

try {
  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "heliyos-docs", version: "1.0.0" },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const tools = [];
  let cursor;
  do {
    const page = await rpc("tools/list", cursor ? { cursor } : {});
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  const prompts = (await rpc("prompts/list")).prompts;
  const templates = (await rpc("resources/templates/list")).resourceTemplates;
  const out = { server: init.serverInfo, protocolVersion: init.protocolVersion, tools, prompts, resourceTemplates: templates };
  writeFileSync(resolve(root, "data/mcp-tools.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`dump-mcp-tools: ${tools.length} tools, ${prompts.length} prompts, ${templates.length} resource templates from ${init.serverInfo.name} ${init.serverInfo.version}`);
} finally {
  clearTimeout(timer);
  child.kill();
}
