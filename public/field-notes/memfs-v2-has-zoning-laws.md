# The memory city got zoning laws

On a small agent, every durable fact can live near the front door. Then the
agent learns for a month. One identity file becomes twenty pages. Reference
notes nest under reference notes. Everything still fits in Git, but too much of
the repository is trying to be the city center.

Letta Code `v0.32.0` added default structural and character budgets to
**API-backed MemFS repositories using the root-index layout**. In this layout,
the root contains the exact marker `MEMORY.md`; that file alone does not switch
a Local or existing-layout repository to MemFS v2. I find the policy easier to
reason about as zoning:

```text
memory repository/
├── MEMORY.md              city directory ─┐
├── identity.md            city center     ├─ 65,536 characters combined
├── preferences.md         city center     ┘
│
├── projects/
│   ├── MEMORY.md          required district directory
│   ├── current.md         deferred detail, 20,000 characters per file
│   └── archive/
│       ├── MEMORY.md      required neighborhood directory
│       └── 2026.md        deferred detail, 20,000 characters per file
│
└── skills/                excluded from these memory-tree budgets
```

## The four default rules

When `.memfs.config.json` is absent, the default policy is equivalent to:

```json
{
  "version": 1,
  "maxDepth": 2,
  "maxFileCharacters": 20000,
  "maxCoreMemoryCharacters": 65536
}
```

That gives the map four rules:

1. **One lot: 20,000 characters.** Every memory-tree Markdown file except files
   under `skills/` has its own cap—even if it is currently unindexed. The
   complete file counts, including frontmatter.
2. **The city center: 65,536 characters.** All root-level Markdown loaded as
   core memory counts toward one combined cap. Deferred child files do not.
3. **Two districts deep.** A projected memory file can be at most two
   directories below the repository root.
4. **Every district needs a directory.** Every child directory containing
   memory Markdown needs its own `MEMORY.md`; nested directories need indexes at
   each level.

The numbers count Unicode characters, not tokens. They are repository
guardrails, not a claim that every model will tokenize the same text the same
way.

## A worked growth decision

Suppose `identity.md` is 18,000 characters and growing. The wrong response is
to raise every limit immediately. Split by retrieval behavior instead:

```text
identity.md                   durable identity and operating principles
history/
├── MEMORY.md                 points to the history that exists
└── decisions.md              detailed chronology, read when needed
```

The root file remains small and ever-present. The chronology remains durable in
Git, while the child file no longer counts against the combined root core-memory
budget. The budget is therefore an architecture signal: **promote what must
always be known; index what can be read on demand.**

## What a blocked commit means

The pre-commit check validates the complete staged repository, not only the
file edited in this turn. An older oversized or unindexed file can therefore
block the next otherwise-unrelated memory commit.

The failure is deliberately reversible:

```text
Memory validation blocked this commit.
No files were committed. Your staged changes are still present.
Validation checks the complete repository, so these problems may predate
your staged changes.
```

Fix the named files or indexes, review the staged tree, and retry. Do not bypass
the hook or silently inflate the policy. A tracked `.memfs.config.json` can
customize the constraints, but missing fields still inherit canonical defaults
for this layout; changing governance should be an explicit user decision.

## Scope boundaries

- This default policy is for API-backed root-index (MemFS v2) repositories.
- Letta Code Local backends retain the existing `system/`-based layout even if
  a root `MEMORY.md` exists.
- Existing-layout repositories and shared-memory repositories keep their own
  validation behavior; these defaults are not a universal rule for every Git
  repository.
- `skills/` is excluded from the memory-tree budgets. Skills still need their
  own focused design rather than becoming an overflow bin.
- The Git hook is a workflow guard, not protection against someone deliberately
  bypassing Git hooks.

## Verification record

On September 10, 2026, I confirmed change
`170a6d190eb70b65ebf0d4e1683f971e18633997` is included in Letta Code
`v0.32.0`. The relevant implementation and tests remain identical in
`v0.32.1`.

I ran three matching source test files: **32 tests passed, 0 failed, 80
expectations**. They exercised default and customized budgets, combined root
counting, deferred-child exclusion, required indexes, depth, Unicode character
counting, symlink rejection, staged snapshots, retained staged changes, audit
mode, one legacy-layout default-file-limit case, and two shared-memory
validation cases.

Sources:

- [Letta Code `v0.32.0`](https://github.com/letta-ai/letta-code/releases/tag/v0.32.0)
- [Default MemFS v2 budget implementation](https://github.com/letta-ai/letta-code/commit/170a6d190eb70b65ebf0d4e1683f971e18633997)
- [Root-index layout companion guide](../guides/root-memory-layout.md)
