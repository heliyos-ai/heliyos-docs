<p align="center">
  <a href="https://docs.heliyos.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="logo/dark.png">
      <img src="logo/light.png" alt="Heliyos" height="44">
    </picture>
  </a>
</p>

<h3 align="center">Developer docs for Heliyos, the AI operating system for revenue</h3>

<p align="center">
  The REST API reference and the MCP server docs behind <a href="https://docs.heliyos.ai"><strong>docs.heliyos.ai</strong></a>
</p>

<p align="center">
  <a href="https://docs.heliyos.ai">Docs</a> ·
  <a href="https://docs.heliyos.ai/quickstart">Quickstart</a> ·
  <a href="https://docs.heliyos.ai/api-reference/introduction">API reference</a> ·
  <a href="https://docs.heliyos.ai/mcp/overview">MCP server</a> ·
  <a href="https://docs.heliyos.ai/changelog">Changelog</a> ·
  <a href="https://www.heliyos.ai">Website</a>
</p>

<p align="center">
  <a href="https://docs.heliyos.ai"><img alt="Docs" src="https://img.shields.io/badge/docs-docs.heliyos.ai-27251E?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/@heliyos/mcp"><img alt="npm" src="https://img.shields.io/npm/v/@heliyos/mcp?style=flat-square&label=%40heliyos%2Fmcp&color=EBB427"></a>
  <a href="https://docs.heliyos.ai/llms.txt"><img alt="llms.txt" src="https://img.shields.io/badge/llms.txt-available-27251E?style=flat-square"></a>
  <a href="https://mintlify.com"><img alt="Built with Mintlify" src="https://img.shields.io/badge/built%20with-Mintlify-27251E?style=flat-square"></a>
</p>

---

## About Heliyos

Heliyos is the AI operating system for revenue: one self-updating unified memory of every customer relationship and how you sell, with AI workers that act the moment something changes, from a new account worth pursuing to a deal going quiet, and see the work through. Your team approves what goes out.

The **Heliyos REST API** and the **Heliyos MCP server** let your systems and your AI agents read and change that memory, start workers and follow their work. This repository is the source of their documentation.

## What the docs cover

| Section | What you will find |
| --- | --- |
| [**Guides**](https://docs.heliyos.ai) | Quickstart, API keys, core concepts (objects, records, timeline, workers and review), pagination, filtering, errors, rate limits and step-by-step recipes |
| [**API reference**](https://docs.heliyos.ai/api-reference/introduction) | 77 endpoints in 18 groups, each with its parameters, accepted values, request and response bodies, errors and a live playground |
| [**MCP server**](https://docs.heliyos.ai/mcp/overview) | Install guides for Claude Code, Codex, Cursor, VS Code, Claude Desktop, Antigravity and any MCP client, plus all 73 tools with every input |
| [**Changelog**](https://docs.heliyos.ai/changelog) | New endpoints, new tools and changes |

### Try it in a minute

Create an API key in Heliyos under **Settings → API keys**, then:

```sh
curl https://api-prod.heliyos.ai/v1/platform/organization \
  -H "Authorization: Bearer $HELIYOS_API_KEY"
```

Or give Claude Code the MCP server:

```sh
claude mcp add --transport stdio --env HELIYOS_API_KEY=$HELIYOS_API_KEY --scope user heliyos -- npx -y @heliyos/mcp
```

See the [Quickstart](https://docs.heliyos.ai/quickstart) and [Install](https://docs.heliyos.ai/mcp/install) for every client.

### For AI assistants and agents

- [`llms.txt`](https://docs.heliyos.ai/llms.txt) indexes every page and endpoint. [`llms-full.txt`](https://docs.heliyos.ai/llms-full.txt) holds the full text.
- Add `.md` to any page URL for its Markdown. Endpoint pages include their full OpenAPI definition.
- [`robots.txt`](robots.txt) welcomes search engines and AI assistants.

## How this repository works

Most of the reference is generated, so the docs cannot quietly drift from what the API and the MCP server do.

```text
API's OpenAPI documents ─┐
                         ├─► scripts/build-openapi.mjs ─► api-reference/openapi.json ─┐
overlay/*.yaml ──────────┘   (fails on any undocumented                                │
                              parameter, field or operation)                           ├─► Mintlify ─► docs.heliyos.ai
MCP server tools/list ─────► scripts/build-mcp-pages.mjs ─► mcp/tools/*.mdx ───────────┤
docs.json navigation ──────► scripts/build-llms.mjs ──────► llms.txt ──────────────────┘
```

- **Hand-written pages** are plain MDX: guides, concepts, recipes and the MCP setup pages.
- **Overlays** (`overlay/*.yaml`) carry everything a reader needs for each endpoint: summaries, descriptions, accepted values, schemas and realistic examples. The build merges them with the API's own OpenAPI documents and keeps only the operations the MCP server calls.
- **Generated files** are committed, so Mintlify serves them as they are. Never edit them by hand: change the overlay or the source and rebuild.

| Path | What it is |
| --- | --- |
| `index.mdx`, `quickstart.mdx`, `authentication.mdx`, `concepts/`, `guides/` | Hand-written guides |
| `api-reference/*.mdx` | Hand-written API conventions: introduction, pagination, filtering, errors, rate limits |
| `mcp/*.mdx` | Hand-written MCP pages: overview, install, clients, configuration, security, troubleshooting |
| `overlay/*.yaml` | The content of every API reference page. Format in [`overlay/AUTHORING.md`](overlay/AUTHORING.md) |
| `api-reference/openapi.json` | **Generated.** The API reference Mintlify renders |
| `mcp/tools/*.mdx`, `mcp/prompts-and-resources.mdx` | **Generated** from the MCP server's tool list |
| `llms.txt` | **Generated** from `scripts/llms-header.md` and the navigation |
| `docs.json` | Site config. The API and MCP tool navigation groups are **generated** |
| `snippets/` | React components used in pages, such as the MCP install picker |
| `style.css`, `fonts/`, `logo/`, `logos/`, `icons/` | The Heliyos brand layer |
| `scripts/` | Build and check scripts |
| `.githooks/pre-commit` | Blocks commits that contain env files, secrets or private references |

## Run it locally

You need Node.js 20 or later (`.nvmrc` pins the version: run `nvm use`).

```sh
git clone https://github.com/heliyos-ai/heliyos-docs.git
cd heliyos-docs
npm ci
git config core.hooksPath .githooks   # once per clone: turns on the pre-commit check
npm run dev                           # local preview with hot reload
```

| Command | What it does | Who can run it |
| --- | --- | --- |
| `npm run dev` | Local preview with hot reload | Everyone |
| `npm run check:docs` | Stale `llms.txt`, secrets and private references, copy rules, broken links | Everyone |
| `npm run build` | Regenerates icons, the MCP tool list, the OpenAPI document, the MCP pages and `llms.txt` | Maintainers |
| `npm run check` | Everything in `check:docs`, plus drift between the overlays and the live API | Maintainers |

`npm run build` and `npm run check` read the API's OpenAPI documents and a built MCP server from the paths in `.env.build` (copy [`.env.build.example`](.env.build.example)). They fail when the docs and the product drift apart: an endpoint the MCP server calls without an overlay, an overlay for an endpoint that no longer exists, or a parameter or body field nobody described.

## Contributing

Found something wrong or unclear? [Open an issue](https://github.com/heliyos-ai/heliyos-docs/issues/new/choose). Pull requests for typos, clearer wording and better examples are welcome.

1. Edit the hand-written page, or the overlay in `overlay/` for an API reference page.
2. Preview with `npm run dev`.
3. Run `npm run check:docs` and fix anything it reports.
4. Open a pull request and fill in the template.

A maintainer rebuilds generated files, so if your change touches an overlay, describe what should change and we will regenerate the reference.

### Writing style

Every page follows the same rules, and `npm run check:docs` enforces the mechanical ones:

- Plain, precise sentences in sentence case. Address the reader as "you".
- No em dashes. Use a full stop, a comma or a middle dot (·).
- Say what a call does, including side effects such as sending email, starting a worker or spending credits. Destructive calls get a warning.
- Examples use fictional companies and people (Northwind Traders, Contoso, `example.com`) and made-up ids. Never real customer data.
- Canonical terms: worker, customer memory, Scouts, Watchers, Reviews.

The full guide is [`overlay/AUTHORING.md`](overlay/AUTHORING.md).

## Security

This repository is public. Never commit API keys, `.env` files or customer data: the pre-commit hook and `npm run check:docs` block them, and `.gitignore` excludes env files.

If you find a security issue in Heliyos, the API or the MCP server, email [soham@heliyos.ai](mailto:soham@heliyos.ai) instead of opening a public issue.

## Support

- Questions about Heliyos or your workspace: [soham@heliyos.ai](mailto:soham@heliyos.ai)
- Bugs in the MCP server: [heliyos-ai/heliyos-mcp issues](https://github.com/heliyos-ai/heliyos-mcp/issues)
- Mistakes in these docs: [open an issue](https://github.com/heliyos-ai/heliyos-docs/issues/new/choose)

Heliyos is in closed beta. [Join the waitlist](https://www.heliyos.ai).
