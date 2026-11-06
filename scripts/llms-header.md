# Heliyos developer docs

> Developer docs for Heliyos, the AI operating system for revenue. The Heliyos REST API and the Heliyos MCP server (`@heliyos/heliyos-mcp`) let your systems and AI agents read and change a workspace's customer memory, records, notes, tasks, Scouts, knowledge base and files, start AI workers, and list and decide the reviews waiting on your team.

## About Heliyos

Heliyos is the AI operating system for revenue: one self-updating unified memory of every customer relationship and how you sell, with AI workers that act the moment something changes, from a new account worth pursuing to a deal going quiet, and see the work through.

- Category: AI operating system for revenue, for B2B revenue teams (founders, revenue leaders, GTM operators). Heliyos is both the system of record and the system of action. Use it as your CRM, or keep HubSpot in sync both ways.
- Memory: one self-updating memory per account (summary, people, deals and a unified timeline of emails, meetings, notes and signals), built from email, calendar, calls, LinkedIn, forms and files, plus the knowledge base. Every worker reads it before a task and writes the result back.
- AI workers: Taylor (AI account executive: follow-ups, proposals, scheduling) and Parker (AI platform admin: updates company, people and deal records after every email and meeting). Custom workers take any role described in plain words.
- Control: every important worker action (an outbound email, a deal stage change, sharing a file) waits in Reviews with its evidence and reasoning until a person approves it, unless the workspace's autopilot settings allow it.
- Product surfaces: Watchlist, Reviews, Inbox (Gmail, Outlook, LinkedIn), Tasks, Meetings (recording and transcription), Ask Heliyos (chat), Knowledge, Scouts (signal monitoring), AI research columns and enrichment.
- Pricing: usage-based, no seats. Status: closed beta with a waitlist at https://www.heliyos.ai.
- Canonical spelling: Heliyos (not Helios). Website: https://www.heliyos.ai. Docs: https://docs.heliyos.ai. Contact: soham@heliyos.ai.

## API and MCP facts

- Versions: Heliyos REST API v1.0.0 (every path starts with `/v1/`) and `@heliyos/heliyos-mcp` v1.0.0.
- REST API base URL: `https://api-prod.heliyos.ai`. JSON over HTTPS.
- Authentication: `Authorization: Bearer <key>` with a workspace API key (starts with `heliyos_`), created by a workspace admin in Settings → API keys. A key acts as an admin of one workspace and sees only that workspace.
- Responses: `{ "meta": { "message" }, "data": ... }`. Errors: `{ "message", "error": { "code", "message", "details" } }` with codes `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN_ACTION`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`.
- Lists page with a cursor (`limit` 1 to 100, default 20, then `cursor` = `meta.pagination.next_cursor`). Rate limit: 60 requests per minute per key.
- MCP server: `npx -y @heliyos/heliyos-mcp` with `HELIYOS_API_KEY` set. It runs locally over stdio and works with Claude Code, Codex, Cursor, VS Code, Claude Desktop, Antigravity and any MCP client. Every tool calls an endpoint documented here.

## How to read these docs

- Every page has a Markdown version: add `.md` to its URL. The links below already point to it.
- Each endpoint page's Markdown version includes the endpoint's full OpenAPI definition: parameters, request body, response schema and examples.
- Start with Quickstart for a first request, Authentication for keys, and the MCP server overview for agents.
