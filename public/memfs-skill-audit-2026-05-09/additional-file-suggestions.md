# Additional suggestions for LETTA-MASTER-INTRO main files

Reviewed files from `github.com/mgit0771/LETTA-MASTER-INTRO` on `main`:

- `00_CONTEXT_CONSTITUTION.md`
- `03_MEMORY_STRUCTURE_TEMPLATE.md`
- `09_MEMFS_FOR_EXTERNAL_AGENTS.md`

This is a separate suggestions file. It does not modify the upstream repository.

## Executive summary

All three files are directionally useful, but I would update them to match the current Letta Code / MemFS framing more closely:

1. **MemFS is self-modification through files**, not only "markdown memory in git".
2. **`system/` is recursively pinned** and should be reserved for durable, low-churn, always-needed context.
3. **Dynamic/live data should not live in `system/`**. Put it outside `system/` and tell the agent to read it when relevant.
4. **Non-`system/` frontmatter descriptions are not enough as a discovery mechanism**. Use pinned index files with `[[path]]` links.
5. **Avoid Note Tool / attach-detach language** unless you are targeting a specific non-Letta implementation. In Letta Code, the practical operations are filesystem reads/searches and skills/subagents.
6. **Do not recommend `limit:` frontmatter as a control mechanism**. Use `description`; audit sizes manually.
7. **Avoid presenting archival memory as the default path for MemFS knowledge**. Archival/conversation search remains a separate system, but MemFS organization should stand on its own.

---

## 1. `00_CONTEXT_CONSTITUTION.md`

### What is good

- Correctly centers identity, memory, continuity, and progressive disclosure.
- Correctly links Context Constitution as a foundation.
- Good agent-facing questions that help an agent reason about continuity and future self.

### What I would change

#### A. Add the product-side update

The file says the standalone Constitution was released 2026-04-02. That is true, but I would add a note that Letta Code default prompt was aligned with the Constitution in Letta Code 0.25.0.

Suggested addition:

```markdown
## Product note

The standalone Context Constitution document is the conceptual source. Letta Code 0.25.0 aligned the default Letta Code system prompt with these principles, so new default Letta Code agents already inherit this framing unless they use a custom system prompt.
```

#### B. Replace "Memory blocks as files" with "prompt/context represented as files"

Current wording:

> Memory blocks jako pliki w filesystem

I would change it to:

```markdown
### MemFS / Context repositories
- Durable context represented as markdown files
- `system/` files are pinned into the prompt recursively
- Non-`system/` files are loaded on demand through filesystem tools
- Git gives history, review, branching, and sync
```

Why: MemFS is not merely old memory blocks serialized into files. The important shift is that the agent can programmatically edit its own durable context.

#### C. Clarify subagent names

Current:

> Defragmentation → Reorganizuj strukturę pamięci

I would make it current/implementation-facing:

```markdown
### Subagents
- `recall` → search/recall past conversation context
- `reflection` → consolidate learnings in the background
- `memory` → defragment/reorganize the memory filesystem
```

#### D. Add an anti-pattern section

Suggested:

```markdown
## Anti-patterns

- Do not treat `system/` as a database. It is prompt context and costs tokens every turn.
- Do not put live state, queues, logs, weather, or file snapshots in `system/`.
- Do not preserve identity by hoarding everything. Preserve identity by keeping durable rules and pointers.
- Do not assume a model remembers because it once saw something. Write durable learnings to memory when they should survive.
```

---

## 2. `03_MEMORY_STRUCTURE_TEMPLATE.md`

This is the file I would change the most.

### Main issue

It mixes older mental models:

- "Core Memory Blocks → Note Tool → Archival"
- `note("attach")` / `note("detach")`
- `limit:` frontmatter
- `active_project.md` in `system/`
- daily updates to `system/active_project.md`
- archival index as a mandatory workflow

For current Letta Code MemFS, I would instead frame the structure as:

```text
Pinned durable context (`system/`)
→ discoverable on-demand files (`reference/`, `projects/`, `patterns/`, `troubleshooting/`)
→ separate recall/archival systems when needed
```

### Specific changes

#### A. Replace "Core Memory Blocks" with "Pinned system context"

Suggested:

```markdown
### Pinned context (`system/`) — always in prompt

`system/` is recursively pinned. Keep it for identity, stable user preferences, durable project conventions, and pointers to on-demand files.

Do not put fast-changing task state here.
```

#### B. Remove `limit:` from templates

Current templates use:

```yaml
limit: 2000
```

I would remove it. Use:

```yaml
---
description: "Agent identity and durable operating principles."
---
```

Why: `limit` is not a reliable protection path in MemFS-era workflows, and teaching it as a primary mechanism creates false confidence.

#### C. Move `active_project.md` out of `system/`

Current structure pins active status/tasks. I would change:

```text
system/project/overview.md       # durable project identity and conventions
projects/current/status.md       # live task state, read on demand
projects/current/todo.md         # live todo, read on demand
```

Rationale: active project status changes often. That is dynamic operational data, not durable identity.

#### D. Replace Note Tool examples

Current:

```python
note("attach", "/references/api-docs")
note("detach", "/references/api-docs")
```

Suggested Letta Code version:

```markdown
When needed, read/search on-demand files directly:

- `Read $MEMORY_DIR/reference/api/rest.md`
- `Grep` or `rg` over `$MEMORY_DIR/reference/`
- Use a pinned index with `[[reference/api/rest.md]]` links so the agent knows what exists.
```

#### E. Replace the decision matrix

Suggested:

```markdown
| Question | If yes | If no |
|---|---|---|
| Needed most turns? | candidate for `system/` | on-demand file |
| Durable/low-churn? | candidate for `system/` | `projects/`, `logs/`, or external state file |
| Small summary enough? | pin summary + links | move details outside `system/` |
| Needs semantic recall? | use recall/archival/search tools | normal filesystem lookup is enough |
```

#### F. Suggested revised structure

```text
memory/
├── system/
│   ├── persona/
│   │   └── identity.md
│   ├── human/
│   │   └── preferences.md
│   ├── project/
│   │   ├── overview.md
│   │   ├── conventions.md
│   │   └── commands.md
│   └── indexes/
│       └── project-index.md
│
├── skills/
│   └── portable-agent-skills/
├── reference/
│   ├── api/
│   └── docs/
├── projects/
│   └── current/
│       ├── status.md
│       └── todo.md
├── patterns/
├── troubleshooting/
└── logs/
```

#### G. Maintenance cadence

Current file says daily update `active_project.md`. I would change:

```markdown
After meaningful changes:
- update the relevant durable or on-demand file,
- commit specific paths,
- push if the memory should sync.

Periodically:
- audit `system/` for stale/dynamic content,
- move volatile data out,
- add/update pinned `[[links]]` for discoverability,
- run `/doctor` or memory subagent for larger cleanup.
```

---

## 3. `09_MEMFS_FOR_EXTERNAL_AGENTS.md`

### What is good

- Good high-level explanation for non-Letta agents.
- Good comparison against vector DB / raw context window / database.
- Correctly emphasizes transparency, git history, and progressive disclosure.

### What I would change

#### A. Make the opening sentence more precise

Current:

> MemFS = Pamięć agenta jako pliki markdown w repozytorium git...

Suggested:

```markdown
MemFS / context repositories represent an agent durable context as git-backed markdown files. Files in `system/` become pinned prompt context; other files are discoverable and loaded on demand. The key benefit is not just storage — it is that the agent can inspect, refactor, and version-control its own context.
```

#### B. Clarify "Git as database"

I would avoid saying "Git jako Database" too strongly. Git is versioning/sync/audit, not a general-purpose runtime database.

Suggested:

```markdown
### Git as versioned context layer
- history and rollback
- reviewable diffs
- sync between clients/environments
- branches/worktrees for experiments

Git is not the whole memory system; it is the versioned representation of durable context.
```

#### C. Update the "vs Vector DB" section

Current says MemFS lacks semantic search but archival can be added. I would make the boundary clearer:

```markdown
### vs Vector DB / RAG
MemFS is better for durable, inspectable, editable identity and working knowledge. Vector search is better for fuzzy retrieval over large corpora. They are not identical tools.

For semantic search over local MemFS/files, use QMD/memfs-search when available. For conversation recall, use the recall/conversation search path. Do not dump everything into `system/` to avoid search.
```

#### D. Replace "każdy plik .md = blok pamięci"

Suggested:

```markdown
Each markdown file is a memory file. Files under `system/` compile into prompt context; files outside `system/` are external context the agent can read when needed.
```

Why: "every `.md` file = memory block" is implementation-adjacent and can mislead people into thinking all files are pinned/equivalent.

#### E. Warn external agents about access scope

External agents such as Claude Code/Codex/Cursor can use the pattern if they can see the folder, but they do not automatically get Letta server-side sync/recompile semantics.

Suggested:

```markdown
## For external agents

Claude Code, Codex, Cursor, Aider, and similar tools can adopt the pattern manually:

- keep durable instructions in a small pinned/read-first set,
- keep references on disk,
- use git for history,
- read files on demand.

But outside Letta Code, `system/` has no magical meaning unless your harness explicitly loads it. You must wire the loading/pinning behavior yourself.
```

#### F. Update implementation section

Suggested:

```markdown
In Letta Code, the local memory repo typically lives under the current agent memory directory and syncs through Letta memfs/git flow when enabled. The exact path and sync behavior depend on the environment, so agents should inspect `$MEMORY_DIR` rather than hardcoding paths.
```

---

## Proposed new short replacement for `03_MEMORY_STRUCTURE_TEMPLATE.md`

If I rewrote that file from scratch, I would make it much shorter:

```markdown
# Memory Structure Template

## Principle

Pinned memory is durable identity and operating context. Everything else is on-demand knowledge.

## Recommended layout

memory/
├── system/
│   ├── persona/identity.md
│   ├── human/preferences.md
│   ├── project/overview.md
│   ├── project/commands.md
│   └── indexes/reference-index.md
├── skills/
├── reference/
├── projects/current/
├── patterns/
├── troubleshooting/
└── logs/

## `system/` rules

Pin content only if it is:
- needed on most turns,
- durable/low-churn,
- concise,
- behavior-changing.

Do not pin live task state, logs, large docs, or full codebase summaries.

## Discovery

Use pinned indexes with `[[path]]` links:

- [[reference/api/rest.md]] — REST API notes
- [[projects/current/status.md]] — current project state
- [[troubleshooting/sync.md]] — memory sync diagnostics

## Git workflow

Edit deliberately, then:

git -C "$MEMORY_DIR" status --short
git -C "$MEMORY_DIR" add specific-files
git -C "$MEMORY_DIR" commit -m "Update memory"
git -C "$MEMORY_DIR" push origin main
```

---

## Priority order if you only change a few things

1. Remove `note("attach")` / `note("detach")` examples from `03_MEMORY_STRUCTURE_TEMPLATE.md`.
2. Remove `limit:` from frontmatter templates.
3. Move `active_project.md` out of `system/` in the recommended structure.
4. Add a clear warning that `system/` is recursively pinned and dynamic data does not belong there.
5. Add `[[path]]` pointer-index guidance.
6. Add the external-agent caveat: outside Letta Code, `system/` only works if the external harness loads it.
