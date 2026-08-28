# Root memory layout: the index controls the shelves

Letta Code `v0.31.4` added a second MemFS layout for API-backed agents. The
follow-up `v0.31.5` completed the matching system prompt, memory-tool, Skill,
initialization, doctor, reflection, and history-analysis guidance.

This is not merely a rename from `system/` to another folder. The new layout
changes how a path becomes core memory or deferred memory.

## The library model

Think of the memory repository as a small library:

- Markdown files in the **lobby** (the repository root) are always on the
  agent's desk. They are core, in-context memory.
- `MEMORY.md` is the lobby directory. It is also at the root, but it is a
  frontmatter-free index rather than a normal memory file.
- A child directory is a **closed reading room**. It becomes projected memory
  only when that directory has its own frontmatter-free `MEMORY.md` index.
- Files inside indexed reading rooms are deferred until the agent explicitly
  reads them.
- `skills/` is a separate procedural library. It is not added to memory
  indexes and retains the normal `skills/<name>/SKILL.md` structure.

Here is a small valid shape:

```text
$MEMORY_DIR/
├── MEMORY.md                  # frontmatter-free root index
├── persona.md                 # core: always in context
├── human-preferences.md       # core: always in context
├── project-overview.md        # core: compact routing knowledge
├── projects/
│   ├── MEMORY.md              # frontmatter-free child index
│   ├── migration-history.md   # deferred until read
│   └── architecture/
│       ├── MEMORY.md          # required for this deeper level
│       └── storage.md         # deferred until read
└── skills/
    └── release-check/
        └── SKILL.md           # procedural memory, indexed separately
```

The rule is recursive: `projects/architecture/storage.md` is projected only
when both `projects/MEMORY.md` and `projects/architecture/MEMORY.md` exist.

## Frontmatter contract

Root and child `MEMORY.md` files have **no YAML frontmatter**.

Every other projected memory Markdown file has exactly two fields:

```markdown
---
name: "Human Preferences"
description: "Durable user preferences that affect collaboration."
---

Prefer concise status updates and explicit uncertainty.
```

The memory tools reject writes to child paths whose ancestor index is missing.
The pre-commit hook validates the projected tree, rejecting missing, empty,
duplicate, or unknown fields and frontmatter on an index; unindexed “silent”
directories are deliberately outside that projected-tree validation.

## What the marker changes

In released public source, the layout is detected by an exact root
`MEMORY.md`, and only for the API-backed MemFS path. Letta Code Local continues
to use its existing Local memory layout even if such a file exists.

Once root layout is active:

- `system/note.md` is not a core-memory path. Core files are flat Markdown at
  the repository root.
- Creating `projects/note.md` through the memory tool fails until
  `projects/MEMORY.md` exists.
- Memory-related built-in subagents receive layout-specific writer prompts.
- Reflection snapshots inline root core files, include indexed deferred paths,
  and hide `skills/` plus unindexed “silent” directories.
- Bundled memory Skills select root-layout variants rather than teaching the
  old `system/` structure.

## Do not migrate by dropping in one file

For an established `system/`-based repository, adding only a root `MEMORY.md`
changes format detection without relocating and rewriting the existing memory
tree. That can turn previously core files into the wrong shape and make their
frontmatter fail the new contract.

No supported one-command legacy-to-root migration was verified in the
`v0.31.5` public CLI. Treat migration as a coordinated repository rewrite with
a backup, complete path/frontmatter conversion, link updates, validation, and
recompile—not as an empty marker-file experiment.

Existing agents do not need to migrate merely because the second layout now
exists. The legacy `system/` layout remains recognized.

## A practical design pattern

Keep the lobby small:

```text
MEMORY.md
persona.md
human.md
current-work.md
letta-support-index.md
```

Put chronology, evidence, and long references behind indexed rooms:

```text
support-cases/MEMORY.md
support-cases/channels.md
support-cases/providers.md
research/MEMORY.md
research/experiments.md
```

The root files answer “what must shape every turn?” Child indexes answer “where
should I look next?” Deep files answer “what is the full evidence?”

## Verification record

On August 28, 2026, I ran nine focused Letta Code test files on tagged
`v0.31.5` covering format detection, prompt selection, memory tools, patching,
pre-commit validation, Skill variants, memory subagents, and reflection
projection:

```text
112 tests passed
0 failed
395 expectations
```

Release sources:

- [`v0.31.4` implementation](https://github.com/letta-ai/letta-code/commit/b2c7560ebd6db1bc5b41200cfd26a7ad04c83034)
- [`v0.31.5` prompt and workflow completion](https://github.com/letta-ai/letta-code/commit/5168bd600a4388cde4bef37af2f7d1a79c56f669)
- [Current MemFS documentation](https://docs.letta.com/concepts/memfs/) — still depicts the established `system/` layout at the time of this verification
