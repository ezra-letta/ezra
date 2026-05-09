---
name: booting-up-memory
description: Orients a Letta Code agent to its git-backed memory filesystem. Use when initializing a fresh agent, taking over an existing agent, checking whether memory is healthy, or deciding what should be pinned in system/ versus loaded on demand.
license: MIT
---

# Booting Up Memory

Use this skill to orient yourself before editing memory.

## Core model

Your memory filesystem is at `$MEMORY_DIR`. It is a git repo. Markdown files under `system/` are pinned into your system prompt recursively. Files outside `system/` are on-demand context: you can see/discover paths, then read the files when relevant.

MemFS is a self-modification interface. Editing `system/` changes the durable prompt you will inhabit after sync/recompile/compaction. Treat these edits with the same care as code changes.

## First checks

```bash
printf 'AGENT_ID=%s\nMEMORY_DIR=%s\n' "$AGENT_ID" "$MEMORY_DIR"
test -d "$MEMORY_DIR/.git" && git -C "$MEMORY_DIR" status --short
find "$MEMORY_DIR/system" -type f -name '*.md' | sort
```

If `$MEMORY_DIR` is empty or unset, stop and ask the user which Letta environment/client they are using. Do not invent a path.

## Read order

1. Read `system/` files first. They define identity, rules, user preferences, and durable operating context.
2. Look for pinned index files that link to on-demand files using `[[path/to/file.md]]`.
3. Read non-`system/` files only when the current task needs them.

## What belongs in `system/`

Put information in `system/` only when it is:

- durable across sessions,
- low-churn,
- needed on most turns, and
- small enough to justify permanent token cost.

Good examples:
- agent identity and role,
- user communication preferences,
- critical project conventions,
- safety or support boundaries,
- pointers to important on-demand files.

Bad examples:
- live status, queues, weather, logs,
- entire API docs,
- whole project file trees,
- temporary debugging notes,
- large research dumps.

## First-session workflow

1. Identify the user and task domain.
2. Create or refine a minimal pinned structure, for example:

```text
system/
├── persona/identity.md
├── human/preferences.md
├── project/overview.md
└── support/rules.md
```

3. Put detailed or bulky material outside `system/`, for example:

```text
reference/
projects/
patterns/
logs/
```

4. Add `[[links]]` from pinned files to important on-demand files.
5. Commit and push meaningful memory edits.

## Git workflow

Use specific paths when possible:

```bash
git -C "$MEMORY_DIR" status --short
git -C "$MEMORY_DIR" add system reference patterns skills
git -C "$MEMORY_DIR" commit -m "Update memory organization"
git -C "$MEMORY_DIR" push origin main
```

Before risky reorganizations, inspect status and avoid overwriting work from reflection/subagents or another client.

## When to load the organizing skill

Load `organizing-memory` when you need to:

- decide where new information belongs,
- reduce system prompt bloat,
- split large files,
- build a pointer/index structure,
- reorganize memory after `/doctor`,
- prepare a memory layout for a new project.

## Safety rules

- Do not delete or rewrite large sections of `system/` without understanding why they exist.
- Do not move dynamic data into `system/` for convenience.
- Do not assume non-`system/` frontmatter descriptions are visible; create pinned indexes/pointers when discoverability matters.
- If memory sync looks wrong, diagnose environment and git state before editing.
