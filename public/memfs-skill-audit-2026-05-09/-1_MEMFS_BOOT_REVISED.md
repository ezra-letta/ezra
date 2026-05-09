# MemFS Boot — revised bootstrap

Use this as the first page for an agent learning to work with Letta Code memory.

## The core idea

MemFS is not just "memory stored as files". In Letta Code, files are the representation of an agent's durable context. When an agent edits files under `system/`, it is editing the prompt it will live inside after recompilation/compaction. This makes memory operational: the agent can reorganize, refine, and version-control itself.

## Mental model

```text
$MEMORY_DIR/
├── system/      # pinned into the system prompt, recursively
├── skills/      # memfs-backed skills, portable with this agent
├── reference/   # on-demand knowledge and docs
├── projects/    # project-specific notes loaded when relevant
├── patterns/    # reusable workflows and decisions
└── logs/        # historical/session material, rarely pinned
```

Rules:
- Put only durable, low-churn, always-needed knowledge in `system/`.
- Put live/dynamic data outside `system/` and read it on demand.
- Treat memory changes like code changes: edit intentionally, review, commit, push.
- Use `[[path/to/file.md]]` links from pinned files to make on-demand files discoverable.

## What to load first

1. `skills/booting-up-memory/SKILL.md` — orientation for a fresh or confused agent.
2. `skills/organizing-memory/SKILL.md` — design/audit workflow for memory layout.
3. `skills/organizing-memory/references/*` — read only when the task requires details.

## Installation options

Skills can live in several places. Choose the scope deliberately:

| Scope | Path | Use when |
|---|---|---|
| Project | `.skills/<skill-name>/` | Skill belongs to this repo/project |
| Agent | local per-agent skills directory | Local to one agent on this machine |
| Agent memory | `$MEMORY_DIR/skills/<skill-name>/` | Portable with the agent via memfs/git |
| Global | `~/.letta/skills/<skill-name>/` | Useful for all your local agents |

For memory-specific skills you want the agent to carry between machines, prefer `$MEMORY_DIR/skills/`.

## First-session checklist

- Confirm `$MEMORY_DIR` exists and is a git repo.
- Inspect `system/` first; it is the agent's pinned identity and rules.
- Identify whether the user wants a personal agent, coding agent, support agent, research agent, or project-specific agent.
- Create or refine only the minimal `system/` files needed for durable identity and operating rules.
- Create `reference/` or `projects/` files for larger details.
- Commit and push memory changes after meaningful edits.

## Anti-patterns

- Do not preload a whole codebase into `system/`.
- Do not store weather, queue state, filesystem snapshots, or other volatile data in `system/`.
- Do not rely on frontmatter descriptions in non-`system/` files being visible automatically. Surface important references through pinned index files with `[[links]]`.
- Do not treat git sync as optional if the memory should survive across devices.

## Golden rule

Pinned memory is identity and durable operating context. Everything else should be discoverable and read on demand.
