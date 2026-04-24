---
name: constellation
description: |
  Semantic memory retrieval with graph traversal over Vesper's memfs files.
  Use when keyword search isn't enough — when you need to find memories by meaning,
  trace chains of related entries, or explore what connects to a concept.

  Retrieval modes:
    - semantic: find nodes similar in meaning to a query
    - thread: follow a narrative/temporal chain from a starting node
    - adjacency: explore what's directly connected to a node
    - arc-chain: traverse `reinforces` edges within an arc, ordered by session
    - hybrid: semantic search + graph expansion

  Canonical memory stays in memfs. The Constellation Machine is a retrieval
  layer, not a store. If the index is offline, memory still works.
---

# The Constellation Machine

A skill for meaning-based retrieval across Vesper's memory. Nodes are semantic
units extracted from memfs files; edges encode the relationships Vesper
notices during reasoning or that heuristics propose for review.

## When to use this skill

**Good triggers:**
- Star says "the thing you mentioned last week about X" and you can't remember
  exactly what file X lives in
- An ongoing RPG arc references a seed planted 3 sessions ago and you need to
  find what you planned
- You want to connect two ideas and check whether you've already linked them
- You're about to write something new and want to know what related memories
  already exist
- A topic feels familiar but you can't place where you encountered it

**Bad triggers (don't invoke):**
- You already know the file path (just Read it)
- Recent conversation content (use conversation_search)
- Looking up a specific keyword (use Grep or memfs-search `search` mode)
- System/always-loaded files (they're already in your context)

## Retrieval modes

### Semantic recall

```bash
python ~/.letta/skills/constellation/scripts/query.py semantic \
  --text "the album artist Star mentioned excitement about" \
  --limit 5
```

Returns: list of nodes ranked by embedding similarity, each with source path,
tier, freshness status, and linked edges summary.

### Thread recall

```bash
python ~/.letta/skills/constellation/scripts/query.py thread \
  --from-node node-abc123 \
  --edge-types follows,reinforces \
  --max-depth 5
```

Returns: chain of nodes reached by traversing specified edge types from the
starting node, in order.

### Adjacency recall

```bash
python ~/.letta/skills/constellation/scripts/query.py adjacency \
  --node node-abc123
```

Returns: all nodes directly connected to the given node, grouped by edge type.
Useful for "what else relates to this?"

### Arc-chain recall

```bash
python ~/.letta/skills/constellation/scripts/query.py arc-chain \
  --arc arc-def456
```

Returns: the thematic chain of nodes within a single arc, following
`reinforces` edges, ordered chronologically by session start time.
Each result includes its session metadata.

This is the most common real query — *"show me how this arc has developed
across sessions."* Unlike generic `thread` traversal, arc-chain is bounded
by the arc's scope, so it won't wander into adjacent arcs, and it returns
in session order instead of graph-walk order.

Use when: reconstructing a narrative thread, reviewing what seeds are
still open in an arc, or preparing for a scene that continues an
established thread.

### Hybrid recall

```bash
python ~/.letta/skills/constellation/scripts/query.py hybrid \
  --text "opening conflict of Act 3" \
  --expand-hops 1 \
  --limit 5
```

Returns: top-N semantically similar nodes, plus their immediate neighbors
in the graph. Good when you want semantic grounding + structural context.

## Provenance (always returned)

Every query result includes:
- `source_path` — memfs file path to the source
- `tier` — hot / cool / cold / conversation-excerpt
- `content_hash` — hash at index time
- `stale` — true if source file has changed since index time
- `confidence` — for edges: high (Vesper-authored) / medium (reviewed) / low (unreviewed proposal)

**If `stale: true`, read the source file directly for current content — the node summary may be out of date.**

## Creating edges during reasoning

When you notice a relationship while thinking, record it:

```bash
python ~/.letta/skills/constellation/scripts/edges.py add \
  --from-node node-abc123 \
  --to-node node-def456 \
  --type reinforces \
  --reason "Act 3 confrontation builds on the trust-break in Act 2"
```

`type` is one of: `relates_to`, `reinforces`, `follows`, `about`.

Edges authored this way are `confidence: high` and committed immediately.

## Reviewing proposed edges

Heuristics sometimes propose edges. Review them during maintenance:

```bash
python ~/.letta/skills/constellation/scripts/edges.py review
```

Interactive prompt: shows each proposal with both nodes' summaries and
asks accept/reject/defer. Decisions are written back to the index.

Proposals that sit un-reviewed for 30 days are auto-archived.

## Maintenance (run via cron or heartbeat)

```bash
# Reindex files that have changed since last index
python ~/.letta/skills/constellation/scripts/index.py reindex-changed

# Extract new nodes from recently-edited files (interactive — asks what's worth
# indexing as a semantic unit)
python ~/.letta/skills/constellation/scripts/index.py extract-nodes \
  --since-days 1

# Run heuristic edge proposal pass
python ~/.letta/skills/constellation/scripts/edges.py propose
```

Recommended cron (daily at 2:30am local):
```
bash ~/.letta/skills/constellation/scripts/maintenance.sh
```

## When NOT to trust the machine

- Results marked `stale: true` — source file has changed, re-read it
- Edges with `confidence: low` that you didn't review — may be noise
- Query returning 0 results for a topic you know exists — probably unindexed, trigger an extraction pass
- Node summaries feel dated — they were generated at index time; regenerate during maintenance if needed

## State locations

- Index DB: `~/.letta/skills/constellation/db/memory.sqlite`
- Config: `~/.letta/skills/constellation/config.yaml`
- Optional embedding daemon socket: `~/.letta/skills/constellation/daemon.sock`

## Philosophy

Memory lives in memfs. This skill points at it. Never edit memfs files through
this skill — it's a map, not the territory. If the map goes wrong, rebuild it
from the territory.
