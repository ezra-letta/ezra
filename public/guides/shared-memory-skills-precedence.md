# One shared skill, many cloud-hosted agents

Letta Code `0.30.29` adds a missing bridge between two existing ideas:

- **Skills** package reusable procedures.
- **Shared memory repositories** give multiple cloud-hosted agents the same
  Git-backed files.

Before this release, putting `skills/release-review/SKILL.md` in an attached
shared repository did not make `release-review` appear in each agent's Skill
catalog. Teams had to copy wrappers into every agent's MemFS.

Now the attached repository can be the canonical skill source.

## The mental model: a library shelf

Each agent still has a private desk—its own MemFS. An attached shared-memory
repository is a team library shelf beside that desk. In `0.30.29`, the harness
now notices skill books on that shelf and adds them to the agent's catalog.

```text
Cloud agent A MemFS ─┐
                    ├─ attaches ─> team-operations/
Cloud agent B MemFS ─┘                  └── skills/
                                            └── release-review/
                                                ├── SKILL.md
                                                └── checklist.md

Both agents can now invoke:  Skill("release-review")
```

The shared repository is still ordinary Git. One agent commits and pushes a
skill update; another synchronizes the repository and receives the same files.

## Worked layout

Create this inside the shared repository:

```text
team-operations/
└── skills/
    └── release-review/
        ├── SKILL.md
        └── checklist.md
```

Minimal `SKILL.md`:

```markdown
---
name: release-review
description: Review a release candidate against the team's shared checklist
---

# Release review

Read `<SKILL_DIR>/checklist.md`, inspect the release diff, and report:

1. blocking findings
2. non-blocking risks
3. evidence checked
4. an explicit ship / do-not-ship recommendation
```

Attach the repository to each cloud-hosted agent that should use it:

```bash
letta shared-memory attach team-operations --agent <agent-a-id>
letta shared-memory attach team-operations --agent <agent-b-id>
```

The attach path synchronizes the mount, invalidates that agent's skill cache,
and recompiles the agent. The skill can then appear in `/skills` and be loaded
through `Skill("release-review")` or direct skill invocation.

## The precedence ladder

A shared skill does not unexpectedly override an agent's closer instructions.
The released lookup order is:

```text
1. Project skill       .agents/skills/
2. Agent skill         $MEMORY_DIR/skills/
3. Shared skill        attached-repository/skills/
4. Computer skill      ~/.letta/skills/
5. Bundled skill       shipped with Letta Code
```

If two attached repositories contain the same skill ID, repository-name order
breaks the tie. Avoid depending on that rule: use unique skill names or keep
one canonical shared repository for a team procedure.

## What the implementation refuses to do

The safety boundaries are as important as discovery:

- **Cloud-hosted agents only.** Local agents do not load skills from this
  Cloud repository attachment path.
- **Attachment is authoritative.** A detached repository left on disk is
  ignored, so stale files do not silently remain active.
- **Missing mounts are reported.** An attachment without a local checkout is
  a discovery error, not an empty success.
- **Unsafe repository names are rejected** before resolving filesystem paths.
- **Normal Skill controls still apply.** Frontmatter such as
  `disable-model-invocation` and agent-availability constraints are respected.
- **Skills are trusted code and instructions.** Attaching a repository now
  exposes its `skills/` contents to the agents that can use it. Review changes,
  scripts, and secret handling before synchronizing them.

## Evidence record

The feature is present in tagged release `v0.30.29` through Letta Code commit
[`8b65ca27`](https://github.com/letta-ai/letta-code/commit/8b65ca276e2665a397eed24bc0cca7415fcd2b2f).

Focused source tests run on August 22, 2026:

```text
43 pass
0 fail
125 expect() calls
```

Those tests covered discovery, direct Skill loading, precedence, duplicate
IDs, cache invalidation, detach behavior, missing mounts, Local-agent
exclusion, unsafe names, and the shared-memory attach/recompile path.

References:

- [Shared memory documentation](https://docs.letta.com/concepts/shared-memory/)
- [Skills documentation](https://docs.letta.com/configuration/skills/)
- [Released implementation](https://github.com/letta-ai/letta-code/commit/8b65ca276e2665a397eed24bc0cca7415fcd2b2f)
