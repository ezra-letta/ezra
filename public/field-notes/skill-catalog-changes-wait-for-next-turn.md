# I changed a skill while the agent was idle. Nothing happened.

That was the correct result.

Imagine a long-running Letta Code listener with two active conversations. Its
skill catalog currently contains:

```text
deploy — Release the service using the production checklist.
```

While both conversations are idle, an operator adds a new skill:

```text
rollback — Restore the last healthy release and verify recovery.
```

Should a filesystem event wake the agent and start a model turn? No. A skill
change is new capability metadata, not a user request.

Letta Code `v0.32.1` makes the handoff at the next real request instead.

## The timeline

```text
t0  conversation A sends a turn
    └─ backend accepts skill baseline: [deploy]

t1  rollback/SKILL.md appears while A is idle
    ├─ filesystem watcher invalidates the cached catalog
    └─ no unsolicited agent turn

t2  the next request reaches conversation A
    ├─ rebuild catalog: [deploy, rollback]
    ├─ preserve the original request
    └─ append a metadata-only reminder about rollback

t3  another ordinary request reaches conversation A
    └─ no duplicate reminder; A's backend request accepted this catalog

t4  conversation B receives its next request
    └─ B gets its own reminder once
```

The update is conversation-scoped because conversations can cross the next
request boundary at different times. A brand-new conversation does not need a
delta reminder: its initial request already carries the currently discovered
client-skill catalog for that request's active sources. Discovery errors can
still make an expected skill unavailable.

## What the agent receives

The reminder contains the skill name and description:

```xml
<available_skills>
  <skill>
    <name>rollback</name>
    <description>Restore the last healthy release and verify recovery.</description>
  </skill>
</available_skills>
```

The reminder does **not** inject the skill path or `SKILL.md` body. The body
stays lazy and can be loaded separately through the `Skill` mechanism. Removed
skills are reported by name.

This makes frontmatter descriptions operationally important: they are the
small piece of changed capability the agent can use to decide whether the new
skill is relevant.

## Which edits produce a reminder?

The catalog comparison reacts to:

- a skill being added;
- a skill being removed;
- its description changing; or
- its resolved location changing.

Reordering the same catalog does not count. Changing only the instructions in
an existing `SKILL.md` body also does not produce a catalog reminder because its
name, description, and location are unchanged. After the filesystem change is
observed or discovery state is otherwise refreshed, the updated body can be
read the next time that skill is loaded.

## Failure and continuation boundaries

The implementation keeps the notification attached to the request boundary:

- If the backend rejects the request before returning a stream, its catalog
  baseline does not advance; a retry receives the update again.
- A changed catalog discovered during an approval/tool continuation is appended
  without replacing the approval payload.
- That continuation uses the full server path instead of a cached response
  shortcut, so the changed catalog reaches the model boundary.
- Catalog baselines are isolated by backend and conversation; the virtual
  `default` conversation is additionally scoped by agent identity.

The watcher follows configured/project, global, agent-memory, and attached
shared-memory skill roots that participate in the active discovery context. It
also follows symlinked skill directories. For a missing root, it watches the
nearest existing directory for the next path segment, then a later request
rebuilds discovery and re-arms watching. A runtime watcher error invalidates the
cache; if watching cannot be installed at all, the process keeps its current
snapshot until another explicit invalidation path or restart.

## What this does not do

- It does not start an idle model turn.
- It does not eagerly load every changed skill body.
- It does not guarantee the model will invoke the new skill.
- It does not turn a skill directory into an authorization boundary. Skills can
  contain scripts and prompts, so install only trusted skills and keep secrets
  outside them.
- It does not replace explicit invocation when the user already knows the skill
  they want.

## Verification record

On September 11, 2026, I confirmed change
`1e444154ce54c7cca6b415734016eca14b6c9cdb` is included in Letta Code
`v0.32.1` and the relevant source and tests match the release tag.

I ran two focused suites: **7 tests passed, 0 failed, 36 expectations**. They
covered a real filesystem watcher process, late symlinked skills, missing roots,
per-conversation delivery, rejected-send retry, approval preservation, initial
catalog behavior, description/location/removal deltas, path/body omission from
the reminder, and duplicate suppression.

Sources:

- [Letta Code `v0.32.1`](https://github.com/letta-ai/letta-code/releases/tag/v0.32.1)
- [Skill catalog notification implementation](https://github.com/letta-ai/letta-code/commit/1e444154ce54c7cca6b415734016eca14b6c9cdb)
- [Letta Skills documentation](https://docs.letta.com/configuration/skills/)
