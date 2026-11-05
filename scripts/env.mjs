/**
 * Build inputs come from the environment, or from `.env.build` in the repo root (gitignored).
 * Nothing here names a location: each machine says where its inputs are.
 *
 *   HELIYOS_PLATFORM_OPENAPI  path to the platform API's OpenAPI document (JSON)
 *   HELIYOS_AUTH_OPENAPI      path to the auth API's OpenAPI document (JSON)
 *   HELIYOS_MCP_ROOT          path to a built checkout of github.com/heliyos-ai/heliyos-mcp
 *   SECRET_ENV_FILES          optional, colon-separated env files whose values must never appear
 *                             in this repository (checked by scripts/check-content.mjs)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const fileVars = (() => {
  const f = resolve(root, ".env.build");
  if (!existsSync(f)) return {};
  return Object.fromEntries(
    readFileSync(f, "utf8")
      .split("\n")
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]])
  );
})();

/** The variable's value, or undefined. */
export const optionalEnv = (name) => process.env[name] ?? fileVars[name];

/** The variable's value; exits with a clear message when it is missing. */
export function requireEnv(name) {
  const v = optionalEnv(name);
  if (!v) {
    console.error(`${name} is not set. Set it in the environment or in .env.build (see scripts/env.mjs).`);
    process.exit(1);
  }
  return resolve(root, v);
}
