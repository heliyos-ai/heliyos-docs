# Writing an overlay

`scripts/build-openapi.mjs` merges the API's generated OpenAPI documents (configured in
`.env.build`, see `scripts/env.mjs`) with the files in this folder, keeps only the operations the MCP server calls, and writes
`api-reference/openapi.json`. The generated documents give paths, parameter names and validation
constraints. The overlay gives everything a reader needs: summaries, descriptions, accepted values,
request and response schemas, and examples.

`notes.yaml` is the reference. Copy its shape.

## File shape

```yaml
tag:
  name: Notes            # navigation group in the API reference
  order: 50              # group order
  description: >-        # one or two sentences, shown on the group
components:              # schemas this group's responses reuse (names must be unique across files)
  Note: { type: object, properties: { ... } }
operations:
  <operationId>:         # exactly the generated operationId
    summary: List notes  # sentence case, starts with a verb, no trailing full stop
    description: |       # markdown: what it does, behaviour worth knowing, links to guides
    parameters:          # EVERY generated path and query parameter, by name
      <name>:
        description: ...
        example: ...     # optional
        schema: { enum: [...] }   # optional: merged onto the generated schema
        omit: true       # optional: hide a parameter that is not for API users (say why in a comment)
    requestBody:         # required when the API takes a body; forbidden when it does not
      schema:            # EVERY top-level property the API accepts, with a description
        type: object
        required: [...]  # must include every property the API requires
        properties: { ... }
      example: { ... }   # or examples: { name: { summary, value } }
    response:
      status: 201        # only when not 200
      description: ...
      message: ...       # the controller's meta.message, verbatim
      pagination: keyset # keyset | offset, for list endpoints
      data: { ... }      # schema of `data` (the envelope is added by the build)
      example: ...       # example of `data` only
      empty: true        # data is {} (instead of data)
      noContent: true    # the API sends no body at all (204)
      specMismatch: why  # when the generated spec's success status is wrong
    errors:              # optional: endpoint-specific error descriptions, by status
      "404": "NOT_FOUND: ..."
    content: |           # optional: MDX shown above the generated page (Notes, Warnings, Steps)
```

Shared schemas live in `_shared.yaml` (`ObjectId`, `Timestamp`, `AuditMetadata`,
`RelationshipInput`, `Relationship`, `ListFilters`). Reference them with
`$ref: "#/components/schemas/<Name>"`. To add a description next to a `$ref`, wrap it:
`allOf: [{ $ref: ... }]` plus `description:`.

## Rules

**Correctness first.** Every statement must be true of the running API, never written from memory or
guessed from a name. Check each operation's method, path, required fields, types, accepted values,
limits, defaults, success status (some deletes answer 204 with no body), `meta.message`, the shape of
`data`, default sort, supported filters and side effects (emails sent, workers started, credits used).
Confirm response shapes against real calls in a test workspace.

When the generated spec and the API disagree, document what the API does and set `specMismatch`.
When you cannot confirm something, write the safest true statement and flag it for verification.
Do not guess enum values or field names.

**No private details.** This repository is public. Never mention internal repositories, source files,
function or class names, internal hosts, infrastructure, vendors behind the API, or anything a
caller does not need. Comments in overlay files follow the same rule. `npm run check` enforces it.

**Accepted values.** For every enum-like field, list every accepted value and what each does.
For every number, its range and default. For every string, its format and length limit.

**Side effects and safety.** Say plainly when a call sends email, starts a worker, spends credits,
is irreversible, or cascades. Destructive calls get a `<Warning>` in `content`.

**Examples.** Realistic and fictional. Use companies such as Northwind Traders, Contoso, Fabrikam,
people with example names, `example.com` addresses and made-up 24-character hex ids. Never copy a
real customer name, email, domain or id from the database, fixtures or logs.

**Copy (Heliyos style).**
- No em dashes anywhere. Use a full stop, a comma or a middle dot (·).
- No "not X but Y" style contrasts. No exclamation marks. No emoji.
- Sentence case. Address the reader as "you".
- Canonical terms and casing: Watchers, Scouts, Autonomous Updates, worker (lowercase), customer memory.
  The API's "agents" are **workers**; the API's "base schemas" are **objects** (say "object (base schema)"
  once per page where the path says `base-schemas`); "classification labels" are **labels**;
  "attachments" are **files**.
- Plain, precise sentences. Say each thing once.

## Check

```sh
export PATH=$HOME/.nvm/versions/node/v23.1.0/bin:$PATH   # Node 20+
node scripts/build-openapi.mjs --partial
```

Your operations must produce no errors. `--partial` only tolerates operations nobody has written yet.
