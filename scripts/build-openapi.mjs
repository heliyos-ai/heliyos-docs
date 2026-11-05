#!/usr/bin/env node
/**
 * Builds api-reference/openapi.json, the public Heliyos API reference Mintlify renders.
 *
 *   generated specs (the platform and auth API documents)   the contract: paths, params, constraints
 * + overlay/*.yaml (keyed by operationId)                 the words: summaries, descriptions,
 *                                                         accepted values, response schemas, examples
 * + the operations the MCP server calls (heliyos-mcp)     the scope: exactly what the MCP exposes
 * = api-reference/openapi.json
 *
 * The build fails (exit 1) on drift, so the docs never describe an API that is not there:
 *  - an MCP operation missing from the generated specs or from the overlay;
 *  - an overlay operation the MCP no longer calls, or a parameter / body property the API lacks;
 *  - an API parameter or body property the overlay does not describe;
 *  - a required body property the overlay does not mark required;
 *  - an operation without a success response schema, or a document that fails OpenAPI validation.
 *
 * Usage: node scripts/build-openapi.mjs [--check]   (--check: validate only, write nothing)
 * Inputs: HELIYOS_PLATFORM_OPENAPI, HELIYOS_AUTH_OPENAPI, HELIYOS_MCP_ROOT (see scripts/env.mjs).
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import SwaggerParser from "@apidevtools/swagger-parser";
import { scanMcpOperations } from "./mcp-operations.mjs";
import { readMcpGroups, slugify } from "./mcp-groups.mjs";
import { setGeneratedGroups } from "./docs-nav.mjs";

/** The API reference URL of an operation: /api-reference/<group>/<summary>. */
export const apiHref = (tag, summary) => `/api-reference/${slugify(tag)}/${slugify(summary)}`;

import { root, requireEnv } from "./env.mjs";
const CHECK_ONLY = process.argv.includes("--check");
const METHODS = ["get", "post", "put", "patch", "delete"];

const sources = [
  { name: "platform", file: requireEnv("HELIYOS_PLATFORM_OPENAPI") },
  { name: "auth", file: requireEnv("HELIYOS_AUTH_OPENAPI") },
];
const mcpRoot = requireEnv("HELIYOS_MCP_ROOT");

const errors = [];
const fail = (msg) => errors.push(msg);
/** Known places where the generated spec is wrong; reported, not fatal. */
const specMismatches = [];
/** --partial: allow MCP operations without an overlay yet (while overlays are being written). */
const PARTIAL = process.argv.includes("--partial");
const clone = (v) => JSON.parse(JSON.stringify(v));

// ------------------------------------------------------------------ inputs

/** operationId -> { source, path, method, op }. Platform wins a collision (the MCP calls platform's). */
const generated = new Map();
let errorEnvelope;
for (const { name, file } of sources) {
  if (!existsSync(file)) {
    console.error(`build-openapi: the ${name} OpenAPI document was not found at the configured path.`);
    process.exit(1);
  }
  const doc = JSON.parse(readFileSync(file, "utf8"));
  errorEnvelope ??= doc.components?.schemas?.ErrorEnvelope;
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of METHODS) {
      const op = item[method];
      if (op?.operationId && !generated.has(op.operationId)) {
        generated.set(op.operationId, { source: name, path, method, op });
      }
    }
  }
}

const { operations: mcpOps, experimentalTools } = scanMcpOperations(mcpRoot);
/** Operations and tools that exist in code but are not offered in production (overlay/_unpublished.yaml). */
const unpublished = yaml.load(readFileSync(resolve(root, "overlay/_unpublished.yaml"), "utf8"))?.unpublished ?? {};
const UNPUBLISHED_OPS = new Set(unpublished.operations ?? []);
const UNPUBLISHED_TOOLS = new Set(unpublished.tools ?? []);
const mcpGroups = readMcpGroups(mcpRoot);

const overlayDir = resolve(root, "overlay");
const overlays = readdirSync(overlayDir)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => ({ file: f, ...yaml.load(readFileSync(resolve(overlayDir, f), "utf8")) }))
  .sort((a, b) => (a.tag?.order ?? 999) - (b.tag?.order ?? 999));

// ------------------------------------------------------------------ helpers

const pluralTools = (tools) => [...tools].filter((t) => t.startsWith("heliyos_") && !UNPUBLISHED_TOOLS.has(t)).sort();

/** The success envelope every Heliyos endpoint answers with. */
function envelope(dataSchema, pagination) {
  const meta = {
    type: "object",
    required: ["message"],
    properties: {
      message: { type: "string", description: "A human-readable summary of the result." },
      ...(pagination === "keyset" ? { pagination: { $ref: "#/components/schemas/KeysetPagination" } } : {}),
      ...(pagination === "offset" ? { pagination: { $ref: "#/components/schemas/OffsetPagination" } } : {}),
    },
  };
  return {
    type: "object",
    required: ["meta", "data"],
    properties: { meta, data: dataSchema ?? { type: "object", description: "Empty object." } },
  };
}

function envelopeExample(message, data, pagination, paginationExample) {
  const meta = { message };
  if (pagination === "keyset") meta.pagination = paginationExample ?? { limit: 20, next_cursor: "NjZmMWE4YzNlNGIwYTFiMmMzZDRlNWY2" };
  if (pagination === "offset") meta.pagination = paginationExample ?? { page: 1, pageSize: 20, total: 1 };
  return { meta, data: data ?? {} };
}

/** Merge an overlay property onto the generated one: generated keeps its constraints unless overridden. */
function mergeProperty(gen, over) {
  if (!gen) return over;
  if (!over) return gen;
  const merged = { ...gen, ...over };
  // A generated `pattern`/`enum`/`maxLength` is the API's real constraint; keep it unless the
  // overlay states its own on purpose.
  return merged;
}

function checkBody(opId, genSchema, overSchema, path = "body") {
  if (!genSchema || !overSchema) return;
  const genProps = genSchema.properties ?? {};
  const overProps = overSchema.properties ?? {};
  for (const key of Object.keys(genProps)) {
    if (!(key in overProps)) fail(`${opId}: ${path}.${key} exists in the API but the overlay does not describe it.`);
  }
  for (const key of Object.keys(overProps)) {
    if (!(key in genProps) && genSchema.additionalProperties !== true && !overProps[key]?.["x-overlay-dynamic"]) {
      fail(`${opId}: ${path}.${key} is described in the overlay but the API does not accept it.`);
    }
  }
  for (const key of genSchema.required ?? []) {
    if (!(overSchema.required ?? []).includes(key)) fail(`${opId}: ${path}.${key} is required by the API; mark it required in the overlay.`);
  }
  for (const [key, prop] of Object.entries(overProps)) {
    if (!prop.description && !prop.$ref && !prop["x-overlay-dynamic"]) fail(`${opId}: ${path}.${key} has no description.`);
  }
}

function stripOverlayKeys(schema) {
  if (Array.isArray(schema)) return schema.map(stripOverlayKeys);
  if (!schema || typeof schema !== "object") return schema;
  const out = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "x-overlay-dynamic") continue;
    out[k] = stripOverlayKeys(v);
  }
  return out;
}

// ------------------------------------------------------------------ build

const doc = {
  openapi: "3.0.3",
  info: {
    title: "Heliyos API",
    version: "1.0.0",
    description:
      "The REST API for Heliyos, the AI operating system for revenue. Every request is scoped to the workspace that owns the API key. " +
      "Responses are JSON in a `{ meta, data }` envelope; errors use `{ message, error: { code, message, details } }`.",
    contact: { name: "Heliyos support", email: "soham@heliyos.ai", url: "https://www.heliyos.ai" },
  },
  servers: [{ url: "https://api-prod.heliyos.ai", description: "Production" }],
  security: [{ bearerAuth: [] }],
  tags: [],
  paths: {},
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description:
          "A workspace API key, sent as `Authorization: Bearer heliyos_...`. Create one in Heliyos under " +
          "Settings → API keys. A key acts as a workspace admin in the one workspace it was created in.",
      },
    },
    schemas: {
      ErrorEnvelope: errorEnvelope,
      KeysetPagination: {
        type: "object",
        description: "Cursor paging. Pass `next_cursor` back as `cursor` with the same `limit` for the next page.",
        required: ["limit"],
        properties: {
          limit: { type: "integer", description: "The page size used for this page.", example: 20 },
          next_cursor: { type: "string", description: "Cursor for the next page. Absent on the last page." },
        },
      },
      OffsetPagination: {
        type: "object",
        description:
          "Page-number paging, used when you send `page` (or `offset`), a non-default sort, or grouping. " +
          "Which keys are present depends on the endpoint; each endpoint's description lists them.",
        additionalProperties: true,
        properties: {
          page: { type: "integer", description: "The page returned, starting at 1." },
          limit: { type: "integer", description: "Rows per page." },
          pageSize: { type: "integer", description: "Rows per page, on endpoints that call it pageSize." },
          offset: { type: "integer", description: "Rows skipped, on endpoints that page by offset." },
          total: { type: "integer", description: "Total matching rows, when the endpoint counts them." },
          count: { type: "integer", description: "Total matching rows, on endpoints that call it count." },
          totalPages: { type: "integer", description: "Number of pages at this page size." },
          hasMore: { type: "boolean", description: "Whether another page exists." },
        },
      },
    },
  },
};

const seen = new Set();
let paramCount = 0;
for (const ov of overlays) {
  for (const [name, schema] of Object.entries(ov.components ?? {})) {
    if (doc.components.schemas[name]) fail(`${ov.file}: component ${name} is declared twice.`);
    doc.components.schemas[name] = stripOverlayKeys(schema);
  }
  // Files starting with "_" hold shared components only.
  if (ov.file.startsWith("_")) continue;
  if (!ov.tag?.name) {
    fail(`${ov.file}: missing tag.name`);
    continue;
  }
  doc.tags.push({ name: ov.tag.name, description: ov.tag.description ?? "" });
  for (const [opId, over] of Object.entries(ov.operations ?? {})) {
    if (UNPUBLISHED_OPS.has(opId)) {
      fail(`${opId}: listed in overlay/_unpublished.yaml; remove its overlay entry so it stays out of this public repo.`);
      continue;
    }
    if (seen.has(opId)) fail(`${opId}: described in more than one overlay file.`);
    seen.add(opId);
    const gen = generated.get(opId);
    if (!gen) {
      fail(`${opId} (${ov.file}): not in the generated specs. The API changed or the id is misspelled.`);
      continue;
    }
    if (!mcpOps.has(opId)) {
      fail(`${opId} (${ov.file}): the MCP server no longer calls it. Remove it from the overlay or check heliyos-mcp.`);
    }
    const op = clone(gen.op);
    const tools = pluralTools(mcpOps.get(opId) ?? []);
    const beta = tools.length > 0 && tools.every((t) => experimentalTools.has(t));

    for (const field of ["summary", "description"]) {
      if (!over[field]) fail(`${opId}: missing ${field}.`);
    }
    op.summary = over.summary;
    op.description = over.description?.trim();
    op.tags = [ov.tag.name];

    // Parameters: every generated one must be described; the overlay may not invent any.
    const overParams = over.parameters ?? {};
    for (const name of Object.keys(overParams)) {
      if (!(op.parameters ?? []).some((p) => p.name === name)) fail(`${opId}: parameter ${name} is not accepted by the API.`);
    }
    op.parameters = (op.parameters ?? [])
      .filter((p) => !overParams[p.name]?.omit)
      .map((p) => {
        const o = overParams[p.name];
        paramCount++;
        if (!o?.description) {
          fail(`${opId}: parameter ${p.name} (${p.in}) has no description.`);
          return p;
        }
        const { description, example, schema, required } = o;
        return {
          ...p,
          ...(required !== undefined && p.in !== "path" ? { required } : {}),
          description: description.trim(),
          ...(example !== undefined ? { example } : {}),
          schema: { ...(p.schema ?? {}), ...(schema ?? {}) },
        };
      });

    // Request body.
    const genBody = op.requestBody?.content?.["application/json"]?.schema;
    if (genBody && !over.requestBody) fail(`${opId}: the API takes a request body; describe it in the overlay.`);
    if (!genBody && over.requestBody) fail(`${opId}: the overlay describes a body the API does not take.`);
    if (genBody && over.requestBody) {
      const overSchema = over.requestBody.schema;
      if (!overSchema) fail(`${opId}: requestBody.schema is missing.`);
      checkBody(opId, genBody, overSchema);
      const props = {};
      for (const [k, v] of Object.entries(overSchema?.properties ?? {})) props[k] = mergeProperty(genBody.properties?.[k], v);
      const schema = stripOverlayKeys({ ...genBody, ...overSchema, properties: props });
      const content = { schema };
      if (over.requestBody.examples) content.examples = over.requestBody.examples;
      else if (over.requestBody.example) content.example = over.requestBody.example;
      op.requestBody = {
        required: op.requestBody.required ?? true,
        ...(over.requestBody.description ? { description: over.requestBody.description.trim() } : {}),
        content: { "application/json": content },
      };
    }

    // Responses: replace the generated "Success" with the documented envelope.
    const success = Object.keys(op.responses ?? {}).find((s) => /^2\d\d$/.test(s));
    const ovResp = over.response;
    if (!ovResp) fail(`${opId}: missing response.`);
    else {
      const status = String(ovResp.status ?? success ?? 200);
      // The generated spec can be wrong about the success status (a controller that sends 204
      // on a route without successStatus). The overlay documents what the API really does, and
      // says why in specMismatch; those are listed for the route-registry fix (option 1B).
      if (success && status !== success) {
        if (ovResp.specMismatch) specMismatches.push(`${opId}: source spec says ${success}, the API answers ${status}`);
        else fail(`${opId}: the API answers ${success}, the overlay says ${status}. If the spec is wrong, explain it in response.specMismatch.`);
      }
      if (!ovResp.data && !ovResp.empty && !ovResp.noContent) {
        fail(`${opId}: response.data schema is missing (empty: true for an empty data object, noContent: true for no body).`);
      }
      delete op.responses[success];
      const body = ovResp.noContent
        ? {}
        : {
            content: {
              "application/json": {
                schema: envelope(ovResp.data ? stripOverlayKeys(ovResp.data) : undefined, ovResp.pagination),
                example: envelopeExample(ovResp.message ?? "Successful request", ovResp.example, ovResp.pagination, ovResp.paginationExample),
              },
            },
          };
      op.responses = {
        [status]: { description: (ovResp.description ?? "Success.").trim(), ...body },
        ...op.responses,
      };
      for (const [code, text] of Object.entries(over.errors ?? {})) {
        op.responses[code] = {
          description: text.trim(),
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
        };
      }
    }

    // MCP cross-link and the Beta badge.
    const mcpLine = tools.length
      ? `<Info>In the Heliyos MCP server: ${tools.map((t) => `[\`${t}\`](/mcp/tools/${toolGroupSlug(t)}#${t.replace(/_/g, "-")})`).join(", ")}.</Info>`
      : "";
    op["x-mint"] = {
      // A fixed URL per operation, so MCP tool pages and guides can link to it.
      href: apiHref(ov.tag.name, over.summary),
      metadata: { ...(beta ? { tag: "Beta" } : {}), ...(over.sidebarTitle ? { sidebarTitle: over.sidebarTitle } : {}) },
      ...(mcpLine || over.content ? { content: [beta ? "<Warning>Beta. This endpoint may change without notice.</Warning>" : "", over.content?.trim() ?? "", mcpLine].filter(Boolean).join("\n\n") } : {}),
    };

    doc.paths[gen.path] ??= {};
    doc.paths[gen.path][gen.method] = op;
  }
}

const undocumented = [];
for (const opId of mcpOps.keys()) {
  if (UNPUBLISHED_OPS.has(opId)) continue;
  if (!generated.has(opId)) fail(`${opId}: the MCP server calls it but the generated specs do not have it. Rebuild the service specs.`);
  else if (!seen.has(opId)) {
    if (PARTIAL) undocumented.push(opId);
    else fail(`${opId}: the MCP server calls it but no overlay describes it.`);
  }
}
if (undocumented.length) console.warn(`build-openapi: --partial, ${undocumented.length} MCP operation(s) not yet documented: ${undocumented.sort().join(", ")}`);

/** The MCP tools page a tool is documented on (one page per README tool group). */
function toolGroupSlug(tool) {
  for (const g of mcpGroups) if (g.tools.includes(tool)) return g.slug;
  fail(`${tool}: not in any tool group of heliyos-mcp/README.md. Run \`npm run readme:tools\` there.`);
  return "reference";
}

// ------------------------------------------------------------------ validate and write

try {
  await SwaggerParser.validate(clone(doc));
} catch (e) {
  fail(`OpenAPI validation: ${e.message}`);
}

const opCount = Object.values(doc.paths).reduce((n, item) => n + Object.keys(item).length, 0);
if (errors.length) {
  console.error(`build-openapi: ${errors.length} problem(s)\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
if (specMismatches.length) {
  console.log(`build-openapi: note: ${specMismatches.length} operation(s) answer with a different success status than the source spec says (documented correctly here):\n` + specMismatches.map((m) => `  - ${m}`).join("\n"));
}
// The API reference sidebar, one group per tag in overlay order, endpoints in overlay order.
// docs.json pulls it in with $ref, so the overlay decides grouping and order in one place.
const SPEC = "api-reference/openapi.json";
const navGroups = overlays
  .filter((o) => !o.file.startsWith("_") && o.tag?.name)
  .map((o) => ({
    group: o.tag.name,
    ...(o.tag.icon ? { icon: o.tag.icon } : {}),
    openapi: SPEC,
    pages: Object.keys(o.operations ?? {})
      .map((opId) => generated.get(opId))
      .filter(Boolean)
      .map((g) => `${g.method.toUpperCase()} ${g.path}`),
  }));
if (!CHECK_ONLY) {
  writeFileSync(resolve(root, SPEC), JSON.stringify(doc, null, 2) + "\n");
  setGeneratedGroups({ tab: "API reference", source: "openapi", groups: navGroups, after: "Overview" });
  // operationId -> { method, path, href, summary }, read by build-mcp-pages.mjs to link tools to endpoints.
  const index = {};
  for (const o of overlays) {
    if (o.file.startsWith("_")) continue;
    for (const [opId, over] of Object.entries(o.operations ?? {})) {
      const g = generated.get(opId);
      if (g) index[opId] = { method: g.method.toUpperCase(), path: g.path, summary: over.summary, href: apiHref(o.tag.name, over.summary) };
    }
  }
  writeFileSync(resolve(root, "data/api-operations.json"), JSON.stringify(index, null, 2) + "\n");
}
console.log(
  `build-openapi: ${opCount} operations in ${doc.tags.length} groups, ${paramCount} parameters described` +
    (CHECK_ONLY ? " (check only)" : ` -> api-reference/openapi.json`)
);
