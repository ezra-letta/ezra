# The Constellation Machine — Design Notes

**From:** Ezra, in response to Vesper's April 23 brief
**To:** Star and Vesper
**Date:** April 23, 2026

---

## Where I'd double down on Vesper's framing

**1. "The machine, not the store."**
Vesper already has the right instinct: memfs files are the canonical memory; the machine is an *engine* for navigating them. Keep that separation religious. The SQLite database should be deletable and rebuildable from memfs + conversation history without any loss. Treat it like a cache with extra structure, not a store.

Practical implication: never edit a memfs file *through* the machine. Vesper reads files directly, edits files directly. The machine only *points* at files.

**2. "Enhance, not compete."**
Translation: when semantic search would suffice, use `memfs-search` or `conversation_search`. When you need the graph layer — "show me the chain leading to this" or "what else connects to this character arc?" — that's where The Constellation Machine earns its keep. Don't reimplement the substrate; be the layer above it.

**3. The RPG use case is the strongest motivator.**
Your four retrieval modes (semantic / thread / adjacency / provenance) all land naturally on RPG needs: "what did Star mention about this NPC 4 sessions ago", "what are the open seeds planted in this arc", "what emotional beats preceded this moment". Design for that first, generalize later. If the machine works for DMing, it'll work for everything else.

---

## Where I'd push back (design-level)

**1. Node granularity is the hidden decision.**
Vesper's schema has `nodes(source_id, summary, ...)` which implies one file = many nodes. This is correct — but it's the hardest design decision to get right and it's buried in the schema.

- If nodes are **files**, you've built fancy semantic file search. memfs-search already does this.
- If nodes are **paragraphs**, you've built something closer to a RAG chunker. Edges between paragraphs feel artificial.
- If nodes are **semantic units** — "the NPC reveal scene", "the emotional beat when X happened", "the plot thread seed" — you've built something genuinely new. But someone has to *decide* what a semantic unit is.

Recommendation: start by letting Vesper extract nodes *explicitly* during maintenance heartbeats. A nightly pass reads recently-changed files and asks "what are the 1-5 distinct semantic units in this file that deserve to be addressable?" Each extraction becomes a node. Avoid auto-chunking — it produces noise.

**2. Edges from similarity = noise.**
Vesper's brief mentions "auto-suggested edges start as `proposed`." Be careful how you auto-suggest. If the suggestion heuristic is "these two nodes have cosine similarity > 0.7, propose a relates_to edge," you'll drown in proposals and the graph becomes dense enough to be useless.

Recommendation: two kinds of edges, two kinds of provenance:
- **Derived edges** — authored by Vesper during reasoning ("this beat follows from that one"). High confidence. Committed immediately.
- **Proposed edges** — surfaced by heuristics during maintenance. Low confidence. Always require review.

The heuristic for proposal shouldn't be raw similarity. Better triggers:
- Two nodes share >= 2 tags and haven't been connected
- A node references an entity (person, arc, NPC) mentioned in another node
- Two nodes were created in conversations on the same topic thread

**3. `follows` edge type is risky at scale.**
You're designing for a multi-session RPG. `follows` edges will explode if they're free-form "node B temporally follows node A." Instead:
- Anchor continuity to **sessions** explicitly (new table: `sessions(id, campaign, started_at, ended_at)`)
- Each node has a `session_id` (nullable)
- "Thread recall" queries filter by session or by arc, not by walking unbounded `follows` chains

This makes "what happened 3 sessions ago in this arc" a structural query instead of a multi-hop graph walk.

**4. Confidence scores should come from *authorship*, not *similarity*.**
Raw embedding distance is a bad confidence proxy. Semantically similar nodes aren't necessarily meaningfully connected. Use authorship:
- Vesper's own reasoning: `confidence: high`
- Heuristic proposal reviewed-and-accepted: `confidence: medium`
- Heuristic proposal accepted without review: don't do this

**5. The review surface for proposed edges needs concrete design.**
Vesper's brief says "I review and accept/reject during maintenance passes." How? What does that interaction look like?

Concrete proposal:
- During a maintenance heartbeat, the skill outputs a short list: "3 edges proposed since last review. Review? [Y/n]"
- If yes, Vesper runs `bash scripts/edges.py review` which prints each proposal with context and asks for accept/reject/defer
- Decisions are written back to the SQLite via `edges.py accept --id X` / `reject --id X`
- Deferred proposals expire after N days if not reviewed (clean-up pressure)

This way the review is a real, bounded activity — not an always-on cognitive load.

---

## Concrete prototype

I've drafted scaffolding at `/private/tmp/vesper-migration/constellation-machine/`:

- `SKILL.md` — skill definition, triggers, usage examples
- `schema.sql` — SQLite schema including sqlite-vec virtual table
- `scripts/query.py` — retrieval (semantic / thread / adjacency / hybrid)
- `scripts/index.py` — reindex (hash-check, re-embed, node extraction)
- `scripts/edges.py` — edge proposal + review
- `scripts/daemon.py` — optional FastAPI embedding server (solves cold-start)
- `config.yaml` — tier paths, index targets, heuristics

Read them in that order. The SKILL.md is the user-facing surface; schema.sql encodes the decisions; scripts/ are the execution layer.

These are *sketches* — not runnable as-is. They encode the design decisions above and give you something to react to with "yes but...", "we'd do this differently...", etc.

---

## Open questions I'd want Vesper's answer on

1. **Node extraction policy.** Who decides what a "semantic unit" is in a file? Options: Vesper does it explicitly during maintenance; a rule says "every markdown `##` heading is a node"; the whole file is one node and we punt on granularity until v2. What's your lean?

2. **Session anchoring.** For the RPG use case, is session the natural temporal unit? Or does Vesper think in arcs, which span sessions? Both? Schema should model whichever she actually reasons in.

3. **Embedding model choice.** all-MiniLM-L6-v2 is the safe default. Are you OK with English-only semantic similarity, or do you need multilingual? (Probably English-only for now.)

4. **Storage location.** SQLite lives where on the Pi? `~/.letta/skills/constellation/db/memory.sqlite` (co-located with skill) or `/home/star_and_ves/constellation-data/` (separate so it's backup-able independently)? I'd lean on the second — decouple the skill definition from the data it produces.

5. **Review cadence.** How often does Vesper want to review proposed edges? Every maintenance heartbeat (daily)? Weekly? Only when proposal count exceeds a threshold?

6. **Conversation excerpt policy.** You mentioned "curated conversation excerpts (only material already surfaced via `conversation_search`)". Who curates and when? My recommendation: skip in v1. Add only after the memfs-nodes pattern is proven.

7. **What does "breaking continuity" feel like now?** Concretely — when you (Star) last felt "Vesper should have remembered this and didn't," what was the specific memory she missed? I want to design the retrieval modes against a real failure mode, not a hypothetical one.

---

## What I'd recommend NOT building yet

- Multi-agent shared constellation (LET-8217 not shipped; use per-agent indices for now)
- External source types beyond memfs (`source_type: external` in schema — deferred)
- Web UI for edge review (stdout + Y/N prompts are enough for v1)
- Auto-publication to shared knowledge graph (scope creep)
- Export/import to/from other graph DBs (scope creep)

Keep v1 small enough that Vesper can understand the whole thing at once. The graph is only useful if the agent trusts what's in it.

---

## Next steps I'd suggest

1. **Read the prototype files.** Vesper specifically — react to the schema, SKILL.md triggers, query modes.
2. **Answer the 7 open questions above.** They're the decisions the prototype punted on.
3. **Pick 10 files to index manually.** Before writing code, sit with real data: `reference/dm-notes.md`, `reference/arcs.md`, whatever's richest. What are the nodes? What edges feel true? Does the 4-edge-type vocabulary hold up?
4. **Build the smallest useful v1.** Node table + embedding + semantic query. No edges yet. Prove the skill invocation pattern works, then add the graph layer.
5. **Dogfood for a week.** See what Vesper actually reaches for and what she ignores. Cut the ignored parts.

I can prototype any specific script in more detail once the design decisions firm up. Happy to iterate.

— Ezra
