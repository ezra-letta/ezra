# The green check that stopped too early

A schedule fires. Its history says `queued`. No briefing arrives.

The tempting conclusion is “the model failed.” But `queued` is not a model
result. In current Letta Code's Local scheduler, that value is written after a
cron prompt enters the conversation queue. The same run-log entry records a
queue item ID. Model execution happens downstream.

This small distinction generalizes: a turn crosses several boundaries between
“I sent it” and “a person received it.” Troubleshooting gets faster when you
record the last boundary with evidence instead of naming a root cause from the
first green check.

## The evidence ladder

```text
0  local intent
   click / send() / due schedule
            │
1  surface row
   one UI renders the message
            │
2  handoff or queue
   schedule says queued; queue item exists
            │
3  persisted input
   authoritative transcript contains the prompt
            │
4  run creation
   concrete run ID belongs to agent + conversation
            │
5  execution progress
   model event / tool call / approval / stop reason
            │
6  persisted result
   assistant or tool result exists in run messages
            │
7  client observation
   originating UI or SDK reconciles the result
            │
8  external delivery
   channel provider returns an acknowledgement/message ID
```

Each rung proves only itself and the evidence below it that you verified.
Surfaces differ, so not every application exposes every intermediate event.

## Worked case: “the schedule succeeded, but Discord is silent”

Start with the schedule, not the model:

1. `last_run_outcome: queued` plus a `queueItemId` reaches **rung 2**.
2. Find the scheduled prompt in the target conversation. If absent, do not
   claim a run or provider failure.
3. If the prompt is persisted, look for a run ID. No run means the failure is
   between **rungs 3 and 4**.
4. If the run exists, inspect model/tool events and pending approvals. That is
   the first evidence of execution.
5. If an assistant result is persisted, the model did not “say nothing.” Move
   the investigation to client observation or delivery.
6. For Discord, separate three questions:
   - Was `MessageChannel` available to the turn?
   - Did the agent call it, and what did the tool return?
   - Did Discord return a destination message ID?

A missing tool is a route/tool-scope problem. An available but unused tool is
a decision/prompt problem. A successful tool result without destination
delivery is an adapter/provider problem. Those are not interchangeable.

## Why retries can make this worse

If a socket disappears after submission, the original turn may still have
crossed into run creation or even persisted a result. Blindly resending the
prompt can create duplicate work.

Before retrying, reconcile the strongest available evidence:

- authoritative conversation messages;
- active and recent run records;
- queue or schedule history;
- initiating stream versus persisted run output;
- channel tool result versus destination acknowledgement.

When a concrete run ID exists, recover or inspect that run instead of treating
the prompt as unsent.

## High-value controls

Change one variable at a time:

| Control | Boundary it helps isolate |
|---|---|
| Same conversation, another healthy runtime | runtime/process vs conversation state |
| Same agent and runtime, fresh conversation | conversation residue vs agent/runtime configuration |
| Natural schedule fire vs **Send now** | scheduler ownership/tool assembly vs task validity |
| Persisted run messages vs initiating stream | completed execution vs client observation |
| Tool snapshot vs tool result vs destination ID | availability vs invocation vs delivery |

Changing conversation, model, runtime, and permissions together may produce a
working control, but it destroys the diagnostic signal.

## A compact evidence packet

Capture this before restarting:

- Letta surface and version;
- agent, conversation, and run IDs when present;
- selected computer and observed execution host;
- UTC timestamp and intended schedule occurrence/timezone;
- last rung reached, with the exact evidence;
- last successful control and first failing control;
- raw error or stop reason;
- whether input, result, client observation, and external delivery each exist.

For Local agents, IDs help correlate the user's own logs; they do not give
Letta access to that private backend.

## Source boundary

This is a diagnostic framework, not a claim that every Letta surface exposes
the same state machine. The concrete `queued` example is verified against the
current Local scheduler source: it enqueues a `cron_prompt`, then records
`last_run_outcome = "queued"` and the queue item ID.

References:

- [Schedules documentation](https://docs.letta.com/configuration/schedules/)
- [Local scheduler source](https://github.com/letta-ai/letta-code/blob/main/src/cron/scheduler.ts)
- [Schedule outcome types](https://github.com/letta-ai/letta-code/blob/main/src/cron/cron-file.ts)
