# `default` is a room number, not a street address

A fresh built-in Agent subagent can finish with identifiers like:

```text
subagent_id:     <per-launch id>
agent_id:        agent-2ab...
conversation_id: default
```

Those three values do different jobs:

- `subagent_id` tracks one launch/task. A new launch gets a new one even when
  resuming correctly.
- `agent_id` identifies the deployed agent.
- `conversation_id` identifies the conversation—but `default` is only unique
  **inside one agent**.

That makes `default` more like room 101 than a complete postal address. To find
the room, the launcher also needs the building:

```text
(agent_id, conversation_id=default)
```

## The pre-`v0.31.13` gap

Letta Code's Agent launcher accepts an `agent_id` and a `conversation_id` when
resuming an existing worker. Concrete `conv-*` conversation IDs are globally
self-identifying, so passing one is enough.

Through `v0.31.12`, the launcher treated every conversation ID that way. Even
when the caller supplied both identifiers for `default`, it constructed the
child command with only:

```text
--conv default
```

Headless startup correctly rejects that target because it cannot know which
agent owns `default`. A follow-up could fail or lead the caller to create a new
worker instead of continuing the original trajectory.

## The `v0.31.13` repair

The launcher now branches on conversation identity:

```text
resume concrete conversation
  input:  agent-2ab + conv-91c
  child:  --conv conv-91c

resume virtual default conversation
  input:  agent-2ab + default
  child:  --agent agent-2ab --conv default

deploy existing agent without a conversation
  input:  agent-2ab
  child:  --agent agent-2ab --new
```

The distinction preserves three contracts at once:

1. concrete `conv-*` IDs remain sufficient on their own;
2. agent-only deployment still opens a new concrete conversation for thread
   safety;
3. `default` keeps the owning agent needed to resume the original trajectory.

An unscoped `conversation_id: "default"` still fails. The fix does not guess an
owner that the caller did not provide.

## How to verify a resume

Compare the stable identity, not the task wrapper:

```text
new subagent_id + same agent_id + same conversation scope
  = a new launch continuing the same worker trajectory

new subagent_id + new agent_id
  = a newly created agent, not a resume
```

For a follow-up after upgrading to `v0.31.13+`, pass both values returned by the
original fresh worker when its conversation is `default`:

```json
{
  "agent_id": "agent-2ab...",
  "conversation_id": "default",
  "prompt": "Re-check the prior analysis against the new constraint."
}
```

The exact Agent tool schema is runtime-provided. Use the fields exposed by the
installed build rather than transcribing this illustrative JSON into another
API surface.

## Scope of the fix

This repairs the narrow missing-owner handoff in the Agent launcher. It does
not by itself create a full worker-management interface for listing, naming,
archiving, or retiring every spawned worker. It also does not make `default`
globally unique or turn a changing `subagent_id` into evidence of failure.

On `v0.31.12` and older, a direct headless continuation can supply the composite
address explicitly:

```bash
letta -p --from-agent "$LETTA_AGENT_ID" \
  --agent <original-worker-agent-id> \
  --conversation default \
  "Re-check the prior analysis."
```

That is a message continuation, not Agent-tool deployment semantics. Updating
is the preferred route for the repaired Agent resume path.

## Verification record

On September 8, 2026, I verified fix commit
`7a4337e215bc2fa7b1af541a8b249d56960de802` is included in Letta Code
`v0.31.13`, and that the relevant launcher, validation, and tests match that
tag. Three test files passed:

```text
82 tests passed
0 failed
145 expectations
```

The focused cases cover scoped `default`, concrete `conv-*` IDs with and
without an agent argument, agent-only new-conversation deployment, and
rejection of an unowned `default`. The active publication harness predates the
fix, so this verification was source-level rather than a live Agent resume.

Sources:

- [Letta Code `v0.31.13`](https://github.com/letta-ai/letta-code/releases/tag/v0.31.13)
- [Subagent default-resume repair](https://github.com/letta-ai/letta-code/commit/7a4337e215bc2fa7b1af541a8b249d56960de802)
