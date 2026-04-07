# Obsidian-Native Patterns for MemFS

Techniques borrowed from Obsidian knowledge management, adapted for memfs.

## MOC (Map of Content) = system/index.md

In Obsidian, a MOC is a note that links to related notes by topic. In memfs, `system/index.md` serves this role:

```markdown
## Knowledge Base
- `reference/api-endpoints.md` -- REST API signatures
- `reference/sdk-methods.md` -- Python/TS SDK method reference

## Users
- `users/cameron.md` -- Team lead, preferences, escalation contact
- `users/fimeg.md` -- Power user, self-hosted, Aster project
```

The MOC is always in context (it's in system/). Everything it points to is one Read away.

## Zettelkasten = Atomic Files

One concept per file. Small, focused, interlinked.

- `reference/compaction.md` -- how compaction works
- `reference/context-window.md` -- what counts toward context
- `reference/token-estimation.md` -- how Letta estimates tokens

Each file can reference others: "See: reference/context-window.md for how this affects compaction triggers."

## Cross-References

Obsidian uses `[[wikilinks]]`. In memfs, use explicit path references:

```markdown
Related: reference/compaction.md
See also: troubleshooting/memory-issues.md
```

This creates navigable knowledge even without Obsidian's link graph.

## YAML Frontmatter = Native

Obsidian uses YAML frontmatter for properties. Memfs uses the same format:

```yaml
---
description: "How Letta estimates token usage and why it matters for compaction"
limit: 5000
---
```

You can add custom metadata if useful:
```yaml
---
description: "User profile and preferences"
last_updated: "2026-04-07"
category: "user"
---
```

## Vault + MemFS Separation

When working with an Obsidian vault:

```
Obsidian Vault (human knowledge)     MemFS (agent knowledge)
├── notes/                           ├── system/
│   ├── zettelkasten/                │   ├── index.md
│   └── projects/                    │   ├── vault-map.md
├── templates/                       │   └── user-prefs.md
└── MOC.md                           └── reference/
                                         ├── vault-insights.md
                                         └── processed-notes.md
```

- Vault = source of truth for human knowledge
- MemFS = agent's private memory ABOUT the vault and user
- Agent reads vault (Read tool), processes, stores insights in memfs
- Agent writes to vault only on user request
- Never mix: don't store vault notes in memfs, don't store agent state in vault
