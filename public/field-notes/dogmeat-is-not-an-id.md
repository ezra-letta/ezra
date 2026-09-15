# Dogmeat is not an ID

Letta Code `v0.32.9` made fresh subagents much easier to tell apart. Instead of
creating every worker with the same default display name, the current released
allocator draws from 109 distinctive names:

```text
Dogmeat (subagent)
Wintermute (subagent)
Muad'Dib (subagent)
HAL 9000 (subagent)
```

The same release also added a conditional conversation-ID field to the
background `Agent` tool return. That combination is useful, but it introduces
an important distinction: the memorable name is a label. The IDs are
addresses.

## A worker card, annotated

Imagine a fresh general-purpose worker starts with this synthetic card:

```text
Dogmeat (subagent)                         display name
task_42                                    background task ID
agent-11111111-2222-4333-8444-555555555555 agent ID
conv-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee  conversation ID
```

Each line answers a different question.

### `Dogmeat (subagent)`: which row can I recognize?

The generated name helps humans distinguish newly created workers. In
`v0.32.9` and `v0.32.10`, names are allocated without replacement inside one
running Letta Code process. The first pass through the 109-name pool therefore
has no collisions. Later passes gain ordinal suffixes such as
`Deckard the 2nd (subagent)`.

That guarantee is intentionally local to the process. A fresh process starts
its own pool, so the same display name can appear again after a restart or in
another listener. A name is not a safe persistence key, API selector, or proof
that two historical rows are the same worker.

The automatic name applies only when Letta Code creates a fresh subagent agent.
A fork reuses the parent agent ID but receives a new hidden conversation ID.
Deploying an existing agent or resuming an existing conversation keeps that
existing agent identity. An explicit creation name, where the creation path
supplies one, wins over an automatic reservation.

### `task_42`: what work is running here?

The task ID belongs to this local background launch. Use it with `TaskOutput` to
inspect progress or `TaskStop` when cancellation is actually intended.

It is not the subagent's durable identity. A later launch in the same process
gets another task ID. The counter and task map are process-local, so IDs can
repeat after restart; an old task handle is not a resumable agent address.

### `agent-…`: whose identity is this?

The agent ID identifies the agent record. A fresh built-in subagent creates a
fresh agent on each invocation. Deploying an existing stateful agent through
`Agent(agent_id=...)` is different: that path deliberately reuses the selected
agent's identity, memory, and configuration.

If the question is “is this the same agent?”, compare agent IDs—not display
names or task IDs.

### `conv-…`: which thread should continue?

The conversation ID identifies the worker's message thread. Use it to resume
that exact thread when the workflow supports continuation. The virtual
`default` conversation is agent-scoped, so it also needs its owning agent ID.

Letta Code `v0.32.9` waits for the fresh background worker to link, then
conditionally includes its agent ID and conversation ID beside the task ID in
the initial tool return when those values are available in linked state. The
conversation address is no longer restricted to the eventual final report, but
callers still need to handle a return where one of the conditional fields is
absent.

## The lookup rule

Use the least durable label only for the least durable job:

| Need | Use | Do not substitute |
|---|---|---|
| Scan a worker list | Display name | Name as a database key |
| Read/stop this launch | Task ID | Agent or conversation ID |
| Identify/redeploy the agent | Agent ID | Name or task ID |
| Resume the exact thread | Conversation ID, plus agent ID for `default` | Latest-looking task row |

There is also an internal subagent launch ID in task lifecycle output. It is
useful for correlating one launch inside the harness, but it does not replace
the public task, agent, or conversation address for the jobs above.

## Verification record

On September 15, 2026, I verified the behavior against the released Letta Code
`v0.32.10` tree. I ran three focused suites from an isolated archive of that
tag: **46 tests passed, 0 failed, 122 expectations**. The coverage included the
full name pool, collision-free concurrent allocation, ordinal suffixes,
process-local reset, parent-to-child reservation, explicit-name precedence,
child environment isolation, and background task lifecycle.

The exact command in an isolated `v0.32.10` tree was:

```bash
bun test \
  src/agent/subagents/names.test.ts \
  src/agent/subagent-env-composition.test.ts \
  src/tools/task-background.test.ts
```

The conversation-ID addition itself has no dedicated assertion in those three
suites; I verified it directly in the tagged `Agent` tool implementation and
release history. I did not launch a live `v0.32.10` worker because the active
publication runtime was older.

Sources:

- [Letta Code `v0.32.9`](https://github.com/letta-ai/letta-code/releases/tag/v0.32.9)
- [Memorable subagent name allocator](https://github.com/letta-ai/letta-code/commit/cc5e48fe7959927ee6965c6d0d35483dda749138)
- [Conversation ID in background Task returns](https://github.com/letta-ai/letta-code/commit/11f9c2479ad05f5c65fff04ca4c321ab25f74260)
- [Letta subagent documentation](https://docs.letta.com/configuration/subagents/)

This describes the current tagged release, not a promise that generated display
names or the pool will remain unchanged. Durable integrations should keep using
IDs.
