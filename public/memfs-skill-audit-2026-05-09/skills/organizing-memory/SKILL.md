---
name: organizing-memory
description: Designs, audits, and restructures Letta Code memory files for durable self-modification, low token waste, and clear progressive disclosure. Use when deciding where memories belong, shrinking system/ bloat, creating pointer maps, or reorganizing an agent's memfs layout.
license: MIT
---

# Organizing Memory

Use this skill to design memory layout. Optimize for durable identity in `system/` and cheap on-demand lookup everywhere else.

## The placement rule

Before pinning anything in `system/`, answer:

1. **Always needed?** Will this matter on most turns, regardless of task?
2. **Durable?** Will it remain true for weeks/months rather than minutes/hours?
3. **Small?** Is the pinned version concise enough to justify permanent token cost?
4. **Behavior-changing?** Would missing it cause materially worse behavior?

If the answer is not clearly yes, put it outside `system/` and link to it from a pinned index if needed.

Read `references/decision-framework.md` for examples and edge cases.

## Recommended structure

Adapt names to the agent, but keep the cost boundary clear:

```text
$MEMORY_DIR/
├── system/                    # pinned recursively
│   ├── persona/               # identity, role, principles
│   ├── human/                 # stable user preferences/context
│   ├── project/               # durable project conventions
│   └── support/               # durable operating rules
├── skills/                    # portable memfs skills for this agent
├── reference/                 # docs, API notes, long explanations
├── projects/                  # project-specific notes and plans
├── patterns/                  # reusable workflows/decisions
├── troubleshooting/           # diagnostic recipes
└── logs/                      # historical notes, low-value by default
```

## Progressive disclosure that actually works

Pinned `system/` files are the place to advertise what exists. Use links:

```markdown
# Project Index

- [[projects/mobile-app/architecture.md]] — architecture, data flow, deployment notes
- [[reference/provider-models.md]] — model/provider quirks to read before changing models
- [[troubleshooting/sync.md]] — memory sync diagnostics
```

Do not assume every non-`system/` file's frontmatter description is automatically visible. If a file matters, link to it from pinned context.

## Token budget guidance

There is no universal magic number. A coding agent can justify more pinned context than a tiny chat companion, but every pinned line still costs tokens every turn.

Use these heuristics:

- Prefer 5-15 focused pinned memory areas over dozens of vague files.
- Keep each pinned file single-purpose.
- Store summaries/rules in `system/`; store details/examples outside.
- Move volatile or bulky data out immediately.
- Use `/context` or equivalent context inspection before and after large memory changes.

## Restructuring workflow

1. Inspect current shape:

```bash
find "$MEMORY_DIR/system" -type f -name '*.md' | sort
wc -c "$MEMORY_DIR"/system/**/*.md 2>/dev/null || true
git -C "$MEMORY_DIR" status --short
```

2. Classify each pinned file:

- keep pinned,
- split pinned summary + on-demand detail,
- move entirely on-demand,
- archive/delete if obsolete.

3. Create or update pinned index files with `[[links]]` to important on-demand files.
4. Commit small, reviewable changes.
5. If available, run `/doctor` or the `memory` subagent for larger defragmentation work.

## What to avoid

- Giant `system/project.md` files that mix architecture, logs, TODOs, and commands.
- Dynamic status files under `system/`.
- Duplicating the same fact in `system/` and `reference/` without a clear source of truth.
- Treating old issue/roadmap status as current truth. Link to docs or verify live when needed.
- Over-abstract folder taxonomies. If a file name does not help retrieval, simplify it.

## References

Read only as needed:

- `references/decision-framework.md` — placement rules and examples.
- `references/production-gotchas.md` — known memory operational gotchas and safer diagnostics.
- `references/pointer-map.md` — current resources for docs, skills, memory, and search.
