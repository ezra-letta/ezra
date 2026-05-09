# MemFS skill audit proposal for LETTA-MASTER-INTRO

Source reviewed: `github.com/mgit0771/LETTA-MASTER-INTRO` on `main`.

Files reviewed:
- `-1_MEMFS_BOOT.md`
- `skills/booting-up-memory/SKILL.md`
- `skills/organizing-memory/SKILL.md`
- `skills/organizing-memory/references/decision-framework.md`
- `skills/organizing-memory/references/pointer-map.md`
- `skills/organizing-memory/references/production-gotchas.md`

This folder is a separate Ezra-side proposal. It does not modify the upstream repository.

## Summary

The original repo is directionally useful: it teaches agents that memory is durable, git-backed, and must be intentionally maintained. The biggest improvements I would make are:

1. Reframe MemFS as **self-modification through files**, not simply "memory as markdown files".
2. Correct progressive disclosure: non-`system/` files are visible primarily as paths in the tree; their frontmatter descriptions are not automatically rendered in the prompt unless surfaced by a pinned/index file.
3. Avoid hard universal size targets like `system/ < 10,000 chars`; instead use a decision rule: pinned content should be durable, low-churn, and needed every turn.
4. Make dynamic/live data explicitly non-`system/`.
5. Reduce stale/version-specific gotchas and point to verification paths instead of presenting old issue status as current.
6. Replace deprecated or uncertain skill names with current Letta Code concepts: `/init`, `/doctor`, `memory` subagent, `syncing-memory-filesystem`, `memfs-search`/QMD when installed.
7. Make installation paths include all skill tiers, including memfs-backed skills in `$MEMORY_DIR/skills/`.

## Proposed contents

- `-1_MEMFS_BOOT_REVISED.md` — shorter bootstrap with corrected mental model and install options.
- `skills/booting-up-memory/SKILL.md` — revised orientation skill.
- `skills/organizing-memory/SKILL.md` — revised memory architecture skill.
- `skills/organizing-memory/references/decision-framework.md` — updated placement framework.
- `skills/organizing-memory/references/pointer-map.md` — updated resource map.
- `skills/organizing-memory/references/production-gotchas.md` — updated gotchas with safer wording.

## What I would not change

- Keep the two-skill split. `booting-up-memory` and `organizing-memory` are distinct enough.
- Keep Polish context in the surrounding repo if the intended users are Polish-speaking.
- Keep references as separate files; that is the right progressive-disclosure shape for skills.
