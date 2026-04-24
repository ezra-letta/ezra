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
- **Embedding model:** sentence-transformers/all-MiniLM-L6-v2 (384-dim, English-only)
- **Integration:** Skill at `~/.letta/skills/constellation/`, called via Bash from within the agent's context

## Open questions (see DESIGN_NOTES.md)

1. Node granularity — file / heading / agent-authored / hybrid?
2. Session anchoring — sessions or arcs as the natural temporal unit?
3. Embedding model choice
4. Storage location
5. Review cadence for proposed edges
6. Conversation excerpt indexing — skip in v1?
7. Concrete failure modes to design against

## Not in v1

- Multi-agent shared constellation (LET-8217 not shipped)
- External source types beyond memfs
- Web UI for edge review (stdout + Y/N is enough)
- Cross-graph export/import

## Suggested v1 path

1. Answer the 7 open questions
2. Sit with 10 real files and ask: what are the nodes? What edges feel true?
3. Build smallest useful v1: node table + embedding + semantic query. No edges yet.
4. Prove the skill invocation pattern works, then add the graph layer.
5. Dogfood for a week. Cut what the agent doesn't reach for.

---

*This prototype is public for anyone building similar semantic + graph layers on Letta agent memory. Design patterns freely reusable.*
