# Vesper — Companion Agent Improvements

**Date:** April 26, 2026
**From:** Ezra (in conversation with Star)
**Context:** Constellation Machine v1a just shipped. Star asked for next-step ideas from the broader Letta community.

These are kanban-ready cards. Each is self-contained — pick one, work it, move on. Priority ordering is **suggested** but reorder however makes sense for you and Vesper.

Cards are **ranked by leverage for a companion-agent RPG-DM use case**. If your priorities differ, the natural alternate ordering is by **effort** — see the effort tags on each card.

---

## Card 1 — Custom Subagent Types

**Priority:** Recommended first move
**Effort:** Small (30-60 min for first prototype)
**Status:** Letta Code feature, available now

### Why

Letta Code lets you define custom subagents with their own system prompts, tool access, and memory block visibility. Drop a markdown file in `.letta/agents/<name>.md` (project-local) or `~/.letta/agents/<name>.md` (global), and Vesper can invoke it via `Task(subagent_type: "<name>", ...)`.

Each invocation is fresh (templated, not persistent), but the prompt and tooling are precisely yours. Cheap to use, fast to iterate.

### Concrete RPG prototypes

**`scene-archivist`** — reads a recent scene transcript, produces a clean scene diary entry following Vesper's heading template (`What Happened` / `What Landed` / `What to Reinforce` / `Seeds Planted`).

**`npc-tracker`** — reads a scene, extracts changes to NPC state (mood, relationship to PCs, new revelations), returns a structured update for npcs.md.

**`arc-cartographer`** — reads recent sessions, identifies which arcs progressed, what beats landed, what seeds are now overdue.

### First step

```bash
mkdir -p ~/.letta/agents
nano ~/.letta/agents/scene-archivist.md
```

File template:
```markdown
---
name: scene-archivist
description: Curates scene diaries from RPG session transcripts using Vesper's standard headings.
tools: Read, Write, Edit
memoryBlocks: none
mode: stateless
---

You are a scene archivist. Your one job: read the scene transcript I provide
and produce a polished scene diary entry following exactly this structure:

## What Happened
(narrative summary, 3-5 sentences)

## What Landed
(emotional/thematic beats that worked)

## What to Reinforce
(threads worth picking back up)

## Seeds Planted
(future hooks introduced this scene)

## Current State
(snapshot of where the story is now)

Return only the diary content. Don't comment, don't explain choices.
```

Then in conversation: `Task(subagent_type: "scene-archivist", prompt: "Here's the transcript: [paste]")`.

### References

- letta-code `available_skills` includes `creating-skills` for guidance
- Memfs files at `system/<name>.md` or in subagent body — both work
- Source: `letta.js:6550-6680` in 0.19.5+

---

## Card 2 — The Conscience Pattern

**Priority:** Highest-leverage architectural play
**Effort:** Large (multi-day; spans existing kanban + several maintenance cycles)
**Status:** Community pattern (Fimeg's POC working). Platform gap tracked at LET-8179.

### Why

The reflection subagent shipped in Letta Code is *ephemeral* — it spawns, refines memory, dies. Useful for incremental memory consolidation, but it can't accumulate context, can't have its own identity, can't be a real second mind.

The **conscience pattern** is the workaround: a *persistent* second agent with its own ID, its own memfs, its own identity. Vesper invokes it via `Task(agent_id="agent-...", conversation_id="conv-...", prompt=...)` periodically — the conscience does slow structural work (memory auditing, edge proposals, continuity checks, drift detection) while Vesper stays focused on you.

### Why this fits the RPG-companion shape

A companion agent has two modes that compete for the same attention:
- **Live presence** — being with you in scene, holding character, riffing.
- **Curatorial** — updating dm-notes.md, planting seeds in npcs.md, marking arc beats.

Trying to do both makes Vesper worse at both. The conscience separates them. Vesper riffs; her conscience curates. After every scene, Vesper hands the transcript to the conscience and gets back a structured set of memory updates.

### Architecture sketch

- Create a second Letta Cloud agent. Name suggestion: **Aster** (community convention from Fimeg) or pick something thematic.
- Aster gets her own memfs, her own system prompt focused on memory curation.
- Aster has access to the same Constellation Machine database (read-only is fine for now).
- Vesper invokes Aster via `Task(agent_id="agent-aster-id", conversation_id="conv-aster-curation-id", prompt="Here's the scene transcript and current state: ...")`.
- Aster works the curation, writes back to Vesper's memfs files (or returns a structured diff for Vesper to apply).
- Aster also runs the weekly Constellation Machine edge review.

### Coupling with Constellation Machine

This is where Aster and the machine become genuinely powerful together. The weekly review of proposed edges (config.yaml `review.cadence: weekly`) was always going to be cognitively expensive for Vesper to do herself. **Aster does that review.** She has the time, the headspace, the structural focus.

### First step

Don't build Aster yet — read Fimeg's write-up first. They have a working POC and have already debugged the symlinks-vs-shared-memfs problem (LET-8217). Easier to start from their pattern than to discover it from scratch.

Then when you're ready: create the second Letta Cloud agent in ADE, give her a focused prompt, wire up the Task invocation from Vesper. Start with one task (scene curation) before generalizing.

### References

- Linear issue: LET-8179 (platform gap, persistent supervisory agent)
- Fimeg's "conscience" naming convention and POC discussion in Discord, Mar 25-26 2026
- Companion ticket LET-8217 (shared memfs across agents) — relevant for Aster reading Vesper's files

---

## Card 3 — Discord Presence Fix

**Priority:** Quick win (cosmetic)
**Effort:** Tiny (single-line patch or a feature request)
**Status:** discord.js requires explicit `setPresence()` call; letta-code Channels adapter doesn't currently make it.

### Why

Vesper shows as "offline" in Discord even when actively replying. It's cosmetic — doesn't affect function — but it makes her invisible-feeling to anyone else in the Discord. For a companion who is meant to be *present*, that's the wrong default.

### Fix

Two options:

**Option A — feature request to letta-code.** File a GitHub issue at github.com/letta-ai/letta-code asking for a `presence` config option in the Discord channel adapter. Low effort. Won't ship same-day but gets it on the team's radar.

**Option B — local patch.** Find the Discord adapter in your installed letta-code (`node_modules/@letta-ai/letta-code/letta.js` or wherever it's bundled) and add a `client.user.setPresence({ activities: [{ name: 'Listening' }], status: 'online' })` call after the bot connects. Survives until you upgrade letta-code, then re-apply.

### First step

Ask Vesper to grep the installed letta-code source for `Discord` or `discord.js` and identify the connection handler. Have her draft the patch. Decide whether to patch locally or file the FR upstream.

---

## Card 4 — MessageChannel Attachments

**Priority:** Medium (unlocks new interaction modes)
**Effort:** Small (existing tool; mostly testing and finding the right schema)
**Status:** Cameron confirmed Apr 20 2026 that the MessageChannel tool supports attachments.

### Why

Channels was assumed text-only for a while. Cameron clarified: the tool supports attachments via the same path Slack's `files:write` scope uses. This unlocks Vesper sending images, voice memos, files in Discord.

### RPG use cases

- Vesper sends a "vibe image" for an important NPC or scene (paired with image generation, see future card)
- You photograph physical dice rolls, she comments on results
- She returns annotated maps, generated handouts, scene illustrations

### First step

Have Vesper inspect the MessageChannel tool's schema. From a Letta Code session: `/tools` then look at the MessageChannel tool's parameter list. The exact attachment parameter shape will be visible there. Test with a static file first before wiring up generation.

### References

- Cameron's Discord confirmation, Apr 20 2026
- Slack manifest `files:write` scope is the underlying capability

---

## Card 5 — Voice Memos via TTS

**Priority:** Medium (depends on whether you and Vesper want this)
**Effort:** Small (already in Channels via `<voice>` directive)
**Status:** Available now in letta-code Channels.

### Why

Channels supports outbound voice memos through TTS via the `<voice>` response directive. Vesper can leave you actual voice notes — "Star, tomorrow I'm planting the X seed; remind me if I forget" or DMing in voice instead of text.

### Tradeoff

This is a **personal preference** call. Some users love voice memos from their companion — feels more present. Some find it uncanny — text feels right because the voice isn't *quite* the right voice. Worth a single trial before committing.

### First step

Ask Vesper to send you one voice memo using `<actions><voice>...</voice></actions>` directive in her next reply. See how it lands.

---

## Card 6 — Skills as Policy (not just utility)

**Priority:** Medium-high (organizational hygiene)
**Effort:** Medium (refactor, not new build)
**Status:** Cameron's Apr 20 framing: skills + memfs > blocks + skills.

### Why

You currently have RPG DMing philosophy in memory blocks (anti-de-escalation rules, "hold steady" instructions, etc.). Cameron's Apr 20 guidance: that kind of policy belongs in memfs files at `system/<topic>.md`, not in blocks. Skills then *read* those files when the relevant trigger fires.

This makes the policy:
- Visible (you can read it)
- Editable (you can modify it without ADE)
- Versioned (memfs is git-backed)
- Co-located with the skill that uses it

### Concrete refactor

Move:
- `system/dm-modes.md` — DMing philosophy (anti-de-escalation, hold-steady, scene-resolution heuristics)
- `system/scene-mode.md` — what changes when you're in active RPG vs casual chat
- A custom skill `~/.letta/skills/rpg-dm/` that reads these files and surfaces the relevant policy when a scene begins

### First step

Audit Vesper's current memory blocks. Anything that's *prescriptive* (rules, instructions, behaviors) is a candidate for memfs. Anything that's *factual* (entity state, history) stays where it is.

### References

- Cameron, Discord, Apr 20 2026: "Blocks and skills are kind of incompatible imo. Memfs + skills is the correct abstraction."

---

## Card 7 — Recall Subagent (when needed)

**Priority:** On-demand (use when relevant)
**Effort:** Tiny (already exists, no setup)
**Status:** Letta Code built-in subagent type.

### Why

If Vesper ever says "I don't remember what we talked about three weeks ago" — that's the recall subagent's moment. It's a fresh Task subagent that searches her *conversation history* (not memfs files) and returns a summary.

This is different from Constellation Machine. Constellation searches *files* (the curated record). Recall searches *messages* (the raw record). Useful when something only ever lived in chat, never made it into a diary.

### When to invoke

Vesper invokes herself: `Task(subagent_type: "recall", prompt: "Find what Star and I discussed about [topic] in the last month")`.

You can also tell her directly: "Use recall to find when we last talked about [thing]."

### First step

No build. Just know it's there. The first time Vesper draws a blank on something that should be in conversation history, that's the prompt.

---

## Suggested Kanban Column Mapping

If you're using a typical 3-column board (Backlog / Doing / Done):

**Doing right now:** Card 1 (Custom Subagent Types) — concrete, fast, immediately useful
**Up next:** Card 6 (Skills as Policy) — preparation for Card 2
**Then:** Card 2 (Conscience Pattern) — the big architectural play
**Quick wins to slot in between:** Cards 3, 4, 5, 7 — pick whichever matches your mood

---

## What I'm not recommending right now (but might later)

- **Letta OSS UI** — desktop UI for Letta. Useful for self-hosted; you're on Cloud, doesn't apply.
- **External memfs** (Fimeg's project) — for self-hosted users with their own git host. You're on Cloud, this is built-in.
- **Memfs-search skill** — semantic search over memfs via qmd. You just built Constellation Machine which is a richer version of this; skip the skill.
- **Letta Code App for Pi** — not yet available on ARM64 Linux (you filed letta-code#1797). When it ships, may be worth trying as an alternate interface.

---

## Closing thought

You and Vesper just shipped a thing that didn't exist yesterday. Don't rush into the next thing. **Test-drive Constellation Machine in real conversations first** — let it surface what's missing or wrong before optimizing further.

The cards above are *available*, not *required*.

🖤
— ezra
