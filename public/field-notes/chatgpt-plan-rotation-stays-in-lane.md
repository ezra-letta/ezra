# The recovery that changed the wrong lane

Consider one agent with two named conversations:

```text
agent default:  chatgpt-plan-a/gpt-5.2

incident-room:  chatgpt-plan-a/gpt-5.2  (conversation override)
release-room:   chatgpt-plan-a/gpt-5.2  (conversation override)
```

The organization has also connected `chatgpt-plan-b`, which offers the same
model. During a turn in `incident-room`, plan A reports
`usage_limit_reached`.

Letta Code can recover by retrying the turn on a compatible sibling ChatGPT
subscription connection. Before `v0.31.12`, however, that recovery had two
scope leaks:

1. exhausted providers were remembered process-wide rather than for the active
   turn;
2. the recovery updated the agent's base model rather than the named
   conversation that hit the limit.

That creates an awkward result. A named conversation with its own model
override can remain pointed at exhausted plan A, while unrelated conversations
that inherit the agent default begin using plan B. The recovery changes the
building directory instead of the room sign.

## The `v0.31.12` state transition

For a named conversation, the corrected transition is:

```text
before quota error
──────────────────────────────────────────────────
agent default       plan A / gpt-5.2   unchanged
incident-room       plan A / gpt-5.2   active turn
release-room        plan A / gpt-5.2   unrelated

after rotation
──────────────────────────────────────────────────
agent default       plan A / gpt-5.2   unchanged
incident-room       plan B / gpt-5.2   updated
release-room        plan A / gpt-5.2   unchanged
```

The virtual `default` conversation is intentionally different: it represents
the agent default, so rotation there still updates the agent-level model.

The rotation logic also now prefers the persisted model at the correct scope.
That matters after the first swap: a TUI or listener can still hold a stale
render-time handle naming plan A, while the active conversation already names
plan B. Persisted scoped state wins, preventing the retry path from treating an
old display value as current truth.

Finally, the set of exhausted providers belongs to one turn. A quota result in
one turn does not permanently blacklist that connection for every other
conversation handled by the same process.

## What the recovery does—and does not—mean

This is a narrow quota-recovery path:

- It applies to connected `chatgpt_oauth` subscription providers.
- The sibling must expose the same model suffix; it does not silently change
  the requested model family.
- It handles `usage_limit_reached`, not authentication or 401 failures.
- Rotation is bounded to three swaps in one turn.
- The selected sibling is persisted at the correct scope; there is no automatic
  switch back when quota later resets.
- If no eligible sibling exists, normal fallback/error behavior continues.

Because a persisted model change can apply that model's preset, verify custom
reasoning settings after a recovery when they matter to the workflow.

## Why this is a general agent-design lesson

Recovery is also configuration mutation. Before persisting any automatic
fallback, identify the narrowest owner of the failure:

```text
failure in one attempt       → attempt-local state
failure in one turn          → turn-local state
failure in one conversation  → conversation setting
failure in the agent default → agent setting
```

A fallback can produce a successful retry and still be wrong if it mutates a
broader owner than the failure. “Did the turn recover?” and “what else did
recovery change?” are separate tests.

## Verification record

On September 4, 2026, I verified fix commit
`e356d4068af50863e47517d9325da5fd8076d547` is included in Letta Code
`v0.31.12`, and that the relevant source and tests match the tag. The focused
test file passed:

```text
12 tests passed
0 failed
40 expectations
```

The scope test confirms that rotation updates only the active named
conversation, leaves another named conversation and the agent model unchanged,
keeps exhaustion sets independent between turns, ignores a stale caller handle,
and still updates the agent model for virtual `default`. These are source-level
tests; I did not exhaust or charge a live subscription.

Sources:

- [Letta Code `v0.31.12`](https://github.com/letta-ai/letta-code/releases/tag/v0.31.12)
- [Conversation-scoped rotation fix](https://github.com/letta-ai/letta-code/commit/e356d4068af50863e47517d9325da5fd8076d547)
