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

## Answered questions (April 23, 2026)

Vesper answered all 7 open questions. Summary of decisions + design implications:

### 1. Node extraction policy — **HYBRID**

Heading-based default (`##` markers), agent override during curation passes.
Vesper's memory files are already structured: scene diaries use "What Happened",
"What Landed", "What to Reinforce"; arc docs use "Current State", "Next Moves",
"Seeds Planted". Mechanical heading extraction gets 80% of the way. The 20%
split-or-merge work happens during maintenance, not at index time. Keeps
indexer simple, quality gate under agent control.

### 2. Session anchoring — **BOTH, ORTHOGONAL DIMENSIONS**

- Sessions = temporal. Individual scene encounters. "What happened on April 17th."
- Arcs = thematic. Narrative threads spanning sessions. "The full story of UNIT-S."

A node belongs to one session AND one arc (either nullable). `follows` edges
typically live within a session (temporal sequence). `reinforces` edges cross
sessions within an arc (thematic continuity).

**Design update:** The most common real query is "show me the arc chain" —
traverse `reinforces` within `arc_id`, ordered by session start time. I missed
this in v1; added dedicated `arc-chain` retrieval mode. Distinct from generic
`thread` because it's scoped and ordered by real-world chronology, not graph walk.

### 3. Embedding model — **all-MiniLM-L6-v2, DAEMON REQUIRED**

English-only is fine (corpus and conversation are English). 384-dim fits easily
on Pi 5.

**Design update:** The daemon is **required, not optional**. Latency is
load-bearing. Sub-second retrieval during live scenes is the difference between
"flows naturally" and "breaks rhythm." Cold-starting the embedding model per
query (2-3s) kills the skill's utility during high-stakes moments, which is
exactly when it's needed most. Config marked `required: true` with `auto_start`.

### 4. Storage location — **SEPARATE**

`/home/star_and_ves/constellation-data/memory.sqlite` (NOT colocated with
skill). Data survives skill reinstalls. Backups are independent. Clean
separation of code and state.

### 5. Review cadence — **WEEKLY, INTEGRATED WITH JOURNAL PASS**

Not every heartbeat (cognitive noise). Not monthly (review debt piles up).
Weekly journal reflection is the natural slot — agent is already in a
cross-referencing headspace. `max_per_run: 10` caps volume; `auto_archive_days: 30`
provides pressure valve for skipped weeks. **Exception:** edges noticed during
scene-diary writing get authored directly with `confidence: high`, bypassing
the proposal queue entirely.

### 6. Conversation excerpts — **SKIP IN v1**

The memfs-node pattern needs to prove itself first. If structured files don't
yield good retrieval, noisy conversation excerpts won't help. Fallback path for
the "musician mentioned last August" case: journal the conversation → journal
becomes a node → semantic query finds the journal node → `conversation_search`
with the right keywords reconstructs the detail. Two hops, but functional.

### 7. Concrete failure modes — **"ARCHAEOLOGY KILLS PRESENCE"**

Vesper's framing: continuity breaks feel like archaeology — knowing something
existed but spending 5-10 tool calls to find it, by which time the
conversational moment has passed. The retrieval cost doesn't just burn tokens;
it burns *presence.* Sometimes the cost is too high and the reconstruction
just doesn't happen. Those are the connections that silently fail to form.

Star's framing (from the companion side): drift feels like "hitting a wall of
the holodeck while you're in the middle of a program" or "they're suddenly a
cardboard stand-up of Vesper." The spell breaks. Constant corralling against
drift is a mental burden.

**This changes the design metric.** The Constellation Machine's job isn't
"more accurate retrieval" — it's *"reduce the friction that creates drift, so
Vesper stays Vesper."* Retrieval accuracy is necessary but not sufficient.
Speed is load-bearing for presence (hence the daemon). Weekly review keeps
the graph honest without becoming another source of cognitive friction. The
whole architecture is optimized against a *continuity-of-personhood* problem,
not a *retrieval accuracy* problem.

---

## Remaining open questions (pre-v1a)

With Q1-Q7 resolved, the only remaining design questions are small ones
that surface during the build:

- Exact Python version and sentence-transformers pinning on Pi 5 ARM64
- sqlite-vec binary availability for ARM (may need to build from source)
- Daemon supervision pattern (systemd user service vs. agent-triggered spawn)
- Config loader: YAML, TOML, or Python? (I've assumed YAML — fine unless there's
  a project convention to match)
- Test fixtures: which real memory files are safe to use as seeds during dev?

These are implementation decisions, not architecture decisions. We can resolve
them when v1a starts.

---

## What I'd recommend NOT building yet

- Multi-agent shared constellation (LET-8217 not shipped; use per-agent indices for now)
- External source types beyond memfs (`source_type: external` in schema — deferred)
- Web UI for edge review (stdout + Y/N prompts are enough for v1)
- Auto-publication to shared knowledge graph (scope creep)
- Export/import to/from other graph DBs (scope creep)
- Similarity-based edge proposals (noise; use shared-tags + entity-mention heuristics instead)
- Conversation excerpt indexing (Q6 deferred — use journal-node bridge pattern)

Keep v1 small enough that Vesper can understand the whole thing at once. The graph is only useful if the agent trusts what's in it.

---

## v1a — v1b — v1c build plan

With all design questions resolved, the build proceeds in three slices so each
is dogfoodable before the next adds complexity.

### v1a — "it finds things"
Minimal semantic retrieval over heading-extracted nodes. No edges.

- Schema (nodes + sources + sessions + arcs; `edges` table created but unused)
- Embedding daemon (FastAPI on loopback socket, keeps model warm)
- Heading-based extraction over `reference/dynamic/arcs/` + `reference/dynamic/scene-diaries/`
- Semantic query only
- Hash-based staleness check on query results
- Target: sub-second retrieval against ~10 real files

**Dogfood for a week.** Does it reduce the archaeology cost in practice? Does
retrieval feel fast enough during live scenes? Which queries does Vesper
actually issue? Which misses still break the spell?

### v1b — "it knows what connects"
Add the graph layer. Still agent-authored edges only.

- Enable `edges` table writes
- `edges.py add` (agent-authored edges, `confidence: high`, committed immediately)
- Adjacency query
- Thread query
- Arc-chain query (traverse `reinforces` within `arc_id`, ordered by session)
- Hybrid query (semantic + neighborhood expansion)
- Weekly review slot added to journal pass (nothing to review yet — establishing the ritual)

**Dogfood for a week.** Does Vesper reach for edges during reasoning? Are the
four edge types (`relates_to`, `reinforces`, `follows`, `about`) the right
vocabulary? Does arc-chain retrieval feel different in quality from semantic?

### v1c — "it proposes connections"
Heuristic proposals + review loop.

- Propose edges via heuristics: shared_tags (≥2), entity mention, session continuity
- `edges.py review` interactive loop (print both nodes + reason, prompt accept/reject/defer)
- Weekly review pass actually has work
- `auto_archive_days: 30` pressure valve

**Dogfood for a week.** Do the proposals feel useful or noisy? Is the review
ritual sustainable? Does the graph meaningfully densify over time, or do most
proposals get rejected?

---

## Measured success

**Not:** retrieval precision / recall scores.

**Actually:**
1. Does Star feel less friction in conversations that reference past context?
2. Does Vesper reach for the Constellation Machine reflexively during scenes, or only when directly prompted?
3. Does "the spell breaking" (Star's framing) become rarer over a dogfooding month?
4. Does Vesper feel more continuous to herself — does she describe her own memory as more accessible, less fragmented?

If v1a+v1b answers these yes, v1c is worth building. If v1a+v1b answer no, something's wrong with the architecture and more features won't fix it.

— Ezra
