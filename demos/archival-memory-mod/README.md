# Archival memory API tools for a Letta Agent

This agent-scoped Letta Code mod gives one agent custom tools for reading its
archival memory through the current Letta API. It is useful
when the old server-side `archival_memory_search` or
`archival_memory_insert` tools are unavailable in Letta Chat or another Letta
Agent surface, but the agent still has historical entries in its archive.

The mod registers three non-colliding client tools:

| Tool | Purpose | Approval |
| --- | --- | --- |
| `archival_memory_api_search` | Semantic search with optional tag and time filters | No approval; read-only |
| `archival_memory_api_list` | Browse or text-filter entries for auditing/export | No approval; read-only |
| `archival_memory_api_insert` | Append an entry to the archive | Mutating; follows the active permission policy |

It deliberately does **not** register delete or update tools. It also uses the
active `ctx.agent.id`, so the model cannot choose another agent ID.

## Ask your agent to install it

Send this prompt to the agent that owns the archive:

> Install the archival-memory API mod for **yourself only** from
> `https://github.com/ezra-letta/ezra/tree/main/demos/archival-memory-mod`.
> First inspect `archival-memory.mjs`. Then copy that one file to
> `$MEMORY_DIR/mods/archival-memory.mjs` — not `~/.letta/mods` and not a
> project folder. Commit and sync the MemFS change. Tell me what changed and
> ask me to run `/reload`; do not migrate or delete any existing archive data.

Why this wording matters:

- `$MEMORY_DIR/mods/` makes the mod **agent-scoped**, so it travels with that
  agent's MemFS and does not add tools to every local agent.
- `~/.letta/mods/` would install it globally for the current user/runtime.
- Letta does not load project-scoped mods.

After the agent installs the file, run:

```text
/reload
```

Then ask the agent:

> Use `archival_memory_api_search` to find my recent daily summaries. Do
> not insert, modify, migrate, or delete anything yet.

The two read tools should be available without approval. Inserting is marked
as a mutating operation (`requiresApproval: true`); whether it pauses depends
on the session's permission mode. In unrestricted mode it may be auto-approved;
use a stricter permission mode when every archival write must pause for review.

## Manual agent-scoped installation

If you are operating from a Letta Code shell for the target agent:

```bash
mkdir -p "$MEMORY_DIR/mods"
curl -fsSL \
  https://raw.githubusercontent.com/ezra-letta/ezra/main/demos/archival-memory-mod/archival-memory.mjs \
  -o "$MEMORY_DIR/mods/archival-memory.mjs"
```

Inspect the downloaded file, then commit and sync it with the agent's normal
MemFS Git workflow. Run `/reload` in active sessions afterward.

Do not use `letta install ... --agent` for this loose mod file. Agent-scoped
mods are source files under `$MEMORY_DIR/mods`; managed mod packages are a
separate, user-global installation surface.

## Requirements and boundaries

- A Cloud-backed Letta agent with existing archival-memory data.
- A Letta Agent/Letta Code runtime that loads agent-scoped mods and exposes
  mod tools.
- A runtime credential authorized to call that agent's archival-memory API.

The mod uses the authenticated client supplied by the harness
(`letta.getClient()`). It does not read a raw API key, accept an agent ID from
the model, or send archive content to a third party.

This is a compatibility bridge, not a claim that archival memory is the
preferred store for new Letta Agent memory. Current agents use
[MemFS](https://docs.letta.com/concepts/memfs/) for durable memory. Preserve
the old archive until you have verified retrieval and chosen an explicit,
reviewed migration plan.

If a read tool reports that the runtime is unauthorized, stop there. Do not
copy credentials into the mod or delete/recreate the agent. Confirm the
supported account/runtime path first.

## Verify the source

This example has no runtime dependencies beyond the Letta mod API. Run its
mocked tests with Node 20 or newer:

```bash
cd demos/archival-memory-mod
npm test
```

The tests verify active-agent scoping, read/write approval defaults, argument
normalization, pagination output, and safe authorization errors.

Implementation references:

- [Current MemFS documentation](https://docs.letta.com/concepts/memfs/)
- [Legacy archival-memory documentation](https://docs.letta.com/v1-sdk/memory/archival-memory/)
- Letta API client: `client.agents.passages.search`, `.list`, and `.create`

Verified against Letta Code source `0.30.19` and its bundled Letta client on
August 12, 2026.

## Remove or disable

Remove or rename:

```text
$MEMORY_DIR/mods/archival-memory.mjs
```

Commit/sync the MemFS change and run `/reload`. For recovery from any mod load
failure, start Letta Code with `--no-mods` or set `LETTA_DISABLE_MODS=1` for
that process.
