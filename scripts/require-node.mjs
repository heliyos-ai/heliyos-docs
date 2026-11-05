#!/usr/bin/env node
/** Stops early with a clear message on Node older than 20 (the Mintlify CLI needs 20+). */
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  console.error(
    `heliyos-docs needs Node 20 or later; this shell runs Node ${process.versions.node}.\n` +
      "Run `nvm use` in this folder (it reads .nvmrc), then try again."
  );
  process.exit(1);
}
