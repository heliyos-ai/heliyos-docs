#!/usr/bin/env node
/**
 * Pre-publish gate for everything in this public repository. Fails (exit 1) on:
 *
 *  Secrets
 *   - credential patterns: Heliyos keys, cloud keys, database URIs, provider tokens, private
 *     keys, JWTs;
 *   - any value from the env files listed in SECRET_ENV_FILES (and ./.env). Values are compared
 *     in memory and never printed.
 *  Private references
 *   - internal hosts, local paths, private repository names and source file paths.
 *  Copy rules
 *   - em dashes and "it's not X, it's Y" in reader-facing files.
 *
 * Usage: node scripts/check-content.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, relative, extname } from "node:path";
import { root, optionalEnv } from "./env.mjs";

const SELF = "scripts/check-content.mjs";
const SKIP_DIRS = new Set(["node_modules", ".git", ".mintlify"]);
const TEXT = new Set([".mdx", ".md", ".json", ".yaml", ".yml", ".mjs", ".js", ".jsx", ".css", ".svg", ".txt"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith(".env") || name === "package-lock.json") continue;
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (TEXT.has(extname(name))) out.push(p);
  }
  return out;
}

const SECRET_PATTERNS = [
  ["Heliyos API key", /heliyos_[A-Za-z0-9]{24,}/],
  ["cloud access key", /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["cloud secret", /secret_access_key\s*[:=]\s*\S{20,}/i],
  ["database URI with credentials", /(mongodb(\+srv)?|postgres(ql)?|mysql|rediss?):\/\/[^\s"'`]*@/],
  ["provider key", /\b(re_|sk-(ant-)?|xox[abprs]-|gh[pousr]_|npm_)[A-Za-z0-9_-]{20,}/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
];

const PRIVATE_PATTERNS = [
  ["internal host", /\b(api-(dev|test|staging)|api\.test|dev)\.heliyos\.ai\b/],
  ["local address", /\blocalhost(:\d+)?\b|\b127\.0\.0\.1\b/],
  ["database cluster", /\.mongodb\.net\b/],
  ["local path", /\/Users\/|\/home\/[a-z]|[A-Z]:\\\\/],
  ["private repository", /\bheliyos-(web|website|platform|auth|agent|api-core|schedule|infrastructure|design|content|launch)[a-z-]*\b|\b[a-z]+-mvc\b|\.\.\/heliyos/],
  ["source path", /\bsrc\/(core|common|auth|services|datastores?|models|workflows|utils|tools|client)\b|\b[A-Za-z]+\.(ts|tsx|py)\b(?!\))/],
  ["internal document", /\bDESIGN( V2)?\.md\b|\bCLAUDE\.md\b|\bAGENTS\.md\b/],
];

const COPY_RULES = [
  ["em dash", /—/],
  ['"it\'s not X, it\'s Y"', /\bit'?s not [^.]{1,60}, it'?s\b/i],
];

/** Values from the configured env files: compared, never printed. */
function secretValues() {
  const NOT_SECRET = /(^GITHUB_REPO$|_NAME$|^AWS_REGION$|^NODE_ENV$|^TZ$|^LOG_LEVEL$)/;
  const files = [resolve(root, ".env"), ...(optionalEnv("SECRET_ENV_FILES") ?? "").split(":").filter(Boolean).map((f) => resolve(root, f))];
  const values = new Set();
  for (const f of files) {
    if (!existsSync(f) || statSync(f).isDirectory()) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*[=:]\s*"?([^"\n#]+)"?/);
      if (!m || NOT_SECRET.test(m[1])) continue;
      const v = m[2].trim();
      if (v.length < 12 || /^(true|false|\d+)$/i.test(v) || /^https:\/\/[a-z0-9.-]*heliyos\.ai\/?$/.test(v)) continue;
      values.add(v);
    }
  }
  return [...values];
}

const secrets = secretValues();
const files = walk(root);
const problems = [];
// Finder and iCloud conflict copies ("notes 2.mdx") are stale duplicates that would ship as pages.
for (const file of files) {
  const rel = relative(root, file);
  if (/ \d+\.[a-z]+$/i.test(rel)) problems.push(`${rel}: looks like a duplicate copy; delete it`);
}
for (const file of files) {
  const rel = relative(root, file);
  if (rel === SELF) continue;
  const text = readFileSync(file, "utf8");
  const readerFacing = !rel.startsWith("scripts/");
  text.split("\n").forEach((line, i) => {
    for (const [label, re] of [...SECRET_PATTERNS, ...PRIVATE_PATTERNS]) {
      // Scripts read the public heliyos-mcp checkout, so its source paths may appear there.
      if (label === "source path" && !readerFacing) continue;
      if (re.test(line)) problems.push(`${rel}:${i + 1}: ${label}`);
    }
    if (readerFacing) for (const [label, re] of COPY_RULES) if (re.test(line)) problems.push(`${rel}:${i + 1}: copy rule: ${label}`);
  });
  for (const v of secrets) if (text.includes(v)) problems.push(`${rel}: contains a value from a secret env file (not shown)`);
}

if (problems.length) {
  console.error(`check-content: ${problems.length} problem(s)\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`check-content: ${files.length} files clean (${SECRET_PATTERNS.length + PRIVATE_PATTERNS.length} patterns, ${secrets.length} secret values, copy rules)`);
