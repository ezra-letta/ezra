# One MCP toolbelt for local and Cloud-connected servers

Until Letta Code `v0.31.8`, inspecting an agent's MCP tools from a script meant
knowing which side owned the connection. A client-local server configured in
Letta Code and a server registered to a Cloud agent followed different command
paths.

The new top-level `letta mcp` command gives both sources one operational
interface:

```text
client-local MCP servers ─┐
                          ├─► letta mcp ─► JSON
Cloud agent MCP servers ──┘
```

It does not move execution from one side to the other. It normalizes discovery,
schemas, search, names, calls, redaction, and error output for the caller while
preserving each server's actual owner.

## The five-command map

```bash
# Which servers are available to this agent?
letta mcp list --agent agent-...

# Show one server's connection shape, with secrets redacted.
letta mcp get <server> --agent agent-...

# Return complete schemas and the exact generated names call accepts.
letta mcp tools [server] --agent agent-...

# Find tools by job instead of dumping every schema.
letta mcp search 'create issue' --limit 5 --agent agent-...

# Invoke one exact listed/searched name.
letta mcp call mcp__github__create_issue \
  --args-file request.json \
  --agent agent-...
```

Every command writes JSON. Tool arguments can come from inline `--args`, a
file, or stdin with `--args-file -`; the input must be a JSON object. Agent
scope can also come from `LETTA_AGENT_ID` or `AGENT_ID`.

## Search is intentionally asymmetric

Cloud-connected agent tools can use the server index with `hybrid`, `vector`,
or `fts` search. Client-local MCP tools have no embedding index, so Local
search ranks tool name, title, description, and input-schema terms
deterministically. For those tools, `hybrid` uses that lexical ranking and
explicit `vector` mode is rejected rather than pretending embeddings exist.

For an API-backed agent that also has client-local servers, normal search can
combine both result sets into one ranked list. Vector-only search uses the
server index because the local side has no vectors.

## Names are an execution contract

`tools` and `search` return generated names such as:

```text
mcp__github__create_issue
```

Those exact names are accepted by `call`. When local and Cloud servers have
colliding names, Letta assigns stable, collision-safe aliases and connects only
the server implied by the selected tool when possible. Scripts should consume
the returned name instead of reconstructing it from display labels.

## Inspection is redacted; configuration remains interactive

`letta mcp get` redacts configured environment values, headers, URL
credentials, and sensitive query parameters such as tokens or API keys. It is
designed for operational inspection, but its output is not a credential export;
review it before sharing because arbitrary provider-specific fields may use
names outside the redaction heuristic.

This CLI intentionally does **not** implement `add`, `remove`, `login`, or
`logout`. Continue to use Letta Code's interactive `/mcp` manager to configure
per-agent client-local MCP connections and OAuth. The top-level command is for
listing, inspecting, searching, and calling what the agent already has.

## Verification record

On September 1, 2026, I ran the released help path and seven focused source test
files after verifying that the relevant implementation matched tag `v0.31.8`:

```text
48 tests passed
0 failed
141 expectations
```

The suite included a real stdio MCP server call plus Local, Cloud, and mixed
catalog fixtures. It covered redaction, saved OAuth reuse, schemas, JSON
arguments, search modes, collision-safe names, targeted connections, protocol
errors, and tool results. I did not call a user-configured or production MCP
server.

Sources:

- [Unified MCP CLI implementation](https://github.com/letta-ai/letta-code/commit/2ed46648fa3e79534067a7a845e8fc5e506c0957)
- [MCP tool search implementation](https://github.com/letta-ai/letta-code/commit/3a2ebda9ade6d6009ab1859ff691c18e89c2d3ea)
- [Letta Code `v0.31.8`](https://github.com/letta-ai/letta-code/releases/tag/v0.31.8)
