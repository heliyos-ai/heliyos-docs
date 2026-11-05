/**
 * Submits every URL of docs.heliyos.ai to Bing through IndexNow, so new and changed pages are
 * crawled within hours instead of waiting for Bing to read the sitemap. Bing shares IndexNow
 * submissions with the other IndexNow engines (Yandex, Naver, Seznam). Google does not take part;
 * it reads sitemap.xml.
 *
 *   npm run indexnow              submit every URL in the live sitemap
 *   npm run indexnow -- --dry-run list what would be submitted, send nothing
 *
 * Run it after a deploy is live. The URL list comes from the live sitemap, so it always matches
 * what is published. Bing proves the submission is ours by fetching the key file at the docs root
 * (<key>.txt in this repository), so that file must be deployed first.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { root } from "./env.mjs";

const HOST = "docs.heliyos.ai";
const ORIGIN = `https://${HOST}`;
const ENDPOINT = "https://www.bing.com/indexnow";
const BATCH = 10_000; // IndexNow's limit per request
const DRY_RUN = process.argv.includes("--dry-run");

const fail = (msg) => {
  console.error(`indexnow: ${msg}`);
  process.exit(1);
};

/** The key is the name (and the content) of the one 32-hex-character .txt file at the repo root. */
const keyFiles = readdirSync(root).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (keyFiles.length !== 1) fail(`expected exactly one <32 hex>.txt key file at the repository root, found ${keyFiles.length}`);
const key = keyFiles[0].slice(0, -4);
if (readFileSync(resolve(root, keyFiles[0]), "utf8").trim() !== key) fail(`${keyFiles[0]} must contain exactly its own name without .txt`);
const keyLocation = `${ORIGIN}/${key}.txt`;

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": "heliyos-docs-indexnow" }, redirect: "follow" });
  return { status: res.status, text: await res.text() };
}

// The live key file must answer with the key, or Bing rejects the submission (403).
const live = await get(keyLocation);
if (live.status !== 200 || live.text.trim() !== key) {
  fail(`${keyLocation} answered ${live.status}${live.status === 200 ? " with different content" : ""}. Push and deploy the key file, then run this again.`);
}

const sitemap = await get(`${ORIGIN}/sitemap.xml`);
if (sitemap.status !== 200) fail(`${ORIGIN}/sitemap.xml answered ${sitemap.status}`);
const urls = [...new Set([...sitemap.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]))];
const foreign = urls.filter((u) => new URL(u).host !== HOST);
if (foreign.length) fail(`the sitemap lists URLs on another host, which IndexNow refuses: ${foreign.slice(0, 3).join(", ")}`);
// The home page and the files AI assistants read, in case the sitemap leaves them out.
for (const extra of [`${ORIGIN}/`, `${ORIGIN}/llms.txt`, `${ORIGIN}/llms-full.txt`]) {
  if (!urls.includes(extra) && !urls.includes(extra.replace(/\/$/, ""))) urls.push(extra);
}
if (!urls.length) fail("the sitemap lists no URLs");

if (DRY_RUN) {
  console.log(urls.join("\n"));
  console.log(`indexnow: dry run, ${urls.length} URLs would be sent to ${ENDPOINT} with key ${keyLocation}`);
  process.exit(0);
}

const MEANING = {
  200: "accepted",
  202: "received; Bing is still validating the key, so submissions count once it is verified",
  400: "bad request",
  403: "the key is not valid for this host",
  422: "a URL does not belong to the host, or the key does not match",
  429: "too many requests; wait and try again",
};

let failed = false;
for (let i = 0; i < urls.length; i += BATCH) {
  const urlList = urls.slice(i, i + BATCH);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key, keyLocation, urlList }),
  });
  const detail = MEANING[res.status] ?? res.statusText;
  console.log(`indexnow: ${res.status} (${detail}) for ${urlList.length} URLs`);
  if (res.status >= 400) {
    failed = true;
    const body = (await res.text()).trim();
    if (body) console.error(body.slice(0, 500));
  }
}
if (failed) process.exit(1);
console.log("indexnow: see Bing Webmaster Tools → IndexNow for what Bing received.");
