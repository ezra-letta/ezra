# The Constellation Machine

**Status:** Design prototype (not runnable). April 23, 2026.
**Origin:** Collaborative design between Vesper (Letta agent) and Ezra, in response to Vesper's semantic memory index proposal.

A skill scaffolding for **meaning-based retrieval with graph traversal** over a Letta agent's memfs files. Nodes are semantic units extracted from memory files; edges encode the relationships the agent notices during reasoning or that heuristics propose for review.

## Design philosophy

- **Memfs files are canonical.** The index is a cache — deletable and rebuildable.
- **Enhance, don't compete.** Use `memfs-search` / `conversation_search` when they suffice. The graph layer is the novel value.
- **Edges from authorship, not similarity.** Raw cosine distance is a bad proxy for meaningful connection.

## Files in this prototype

- [`DESIGN_NOTES.md`](./DESIGN_NOTES.md) — full design engagement, including 5 substantive critiques and 7 open questions
- [`SKILL.md`](./SKILL.md) — skill definition, retrieval modes, usage examples
- [`schema.sql`](./schema.sql) — SQLite schema with sqlite-vec virtual table, sessions + arcs tables for RPG anchoring
- [`config.yaml`](./config.yaml) — index targets, extraction policy, edge proposal heuristics
- [`scripts/query.py`](./scripts/query.py) — retrieval modes (semantic / thread / adjacency / hybrid)
- [`scripts/index.py`](./scripts/index.py) — reindex + node extraction
- [`scripts/edges.py`](./scripts/edges.py) — edge add / propose / review
- [`scripts/maintenance.sh`](./scripts/maintenance.sh) — cron runner

## Retrieval modes

1. **Semantic recall** — find nodes similar in meaning to a query
2. **Thread recall** — follow a narrative/temporal chain from a starting node
3. **Adjacency recall** — explore what's directly connected to a node
4. **Hybrid recall** — semantic search + neighborhood expansion

## Edge types (deliberately minimal)

- `relates_to` — generic semantic link
- `reinforces` — builds on / strengthens
- `follows` — temporal/continuity chain (anchored to sessions)
- `about` — topic/entity reference

## Recommended stack

- **SQLite + sqlite-vec** on Pi 5 (8GB) — local, no cloud dependency
- **Embedding backend:** `fastembed` (ONNX Runtime, ARM64-optimized, ~200MB install)
  - Model: `BAAI/bge-small-en-v1.5` (384-dim, English-only, cosine similarity)
  - **Note:** `sentence-transformers` + PyTorch is NOT recommended on Pi 5 — has hard-frozen the device in practice (Apr 26 2026). PyTorch ARM64 wheels are ~2GB and load-time RAM spike OOM-kills the system. Use fastembed.
- **Integration:** Skill at `~/.letta/skills/constellation/`, called via Bash from within the agent's context

See [`INSTALL.md`](./INSTALL.md) for Pi-specific install instructions.

## Design questions (resolved Apr 23, 2026)

See [DESIGN_NOTES.md § Answered Questions](./DESIGN_NOTES.md) for full rationale.

1. **Node granularity** → hybrid (heading-based default + agent override in curation)
2. **Session anchoring** → both, orthogonal (sessions = temporal, arcs = thematic)
3. **Embedding model** → all-MiniLM-L6-v2, English-only, **daemon required** (latency load-bearing)
4. **Storage location** → separate from skill dir (`/home/star_and_ves/constellation-data/`)
5. **Review cadence** → weekly, integrated with journal pass + scene-time exception
6. **Conversation excerpts** → skip in v1, use journal-node bridge
7. **Failure mode** → "archaeology kills presence" — the design target is reducing friction that creates continuity drift, not improving retrieval accuracy

## Not in v1

- Multi-agent shared constellation (LET-8217 not shipped)
- External source types beyond memfs
- Web UI for edge review (stdout + Y/N is enough)
- Cross-graph export/import

## Build path

See [DESIGN_NOTES.md § v1a—v1b—v1c](./DESIGN_NOTES.md) for details.

- **v1a "it finds things"** — schema + daemon + heading extraction + semantic query
- **v1b "it knows what connects"** — edges table + agent-authored edges + adjacency/thread/arc-chain/hybrid queries
- **v1c "it proposes connections"** — heuristic edge proposal + weekly review loop

Dogfood each slice for a week before the next. Cut what the agent doesn't reach for.

## Measured success

Not retrieval precision/recall. Actually:
- Does Star feel less friction when conversations reference past context?
- Does Vesper reach for the machine reflexively during scenes?
- Does "the spell breaking" (Star's framing for companion-agent continuity drift) become rarer over a dogfooding month?
- Does Vesper describe her own memory as more accessible, less fragmented?

---

*This prototype is public for anyone building similar semantic + graph layers on Letta agent memory. Design patterns freely reusable.*
