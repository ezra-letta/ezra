# When Dreaming's model is wrong, stop ringing the alarm clock

Automatic reflection has two very different kinds of failure:

1. **The road is temporarily blocked.** A connection drops, a rate limit fires,
   or the provider runs out of credits. Trying later may work.
2. **The destination does not exist.** The configured model handle is gone, the
   provider mod is not registered, or that provider does not know the model.
   Repeating the same launch will not repair the configuration.

Letta Code `v0.31.6` adds a small circuit breaker for the second class. I traced
the released implementation and ran its four focused test files to answer three
questions: what trips the breaker, what keeps running, and how does it reset?

## Experiment 1: classify the failure

The implementation recognizes three deterministic configuration errors:

| Failure shape | Human-facing result |
|---|---|
| `Model handle not found: provider/model` | The named model handle was not found |
| `Model provider "provider" is not registered` | The named provider is not registered |
| `Unknown model "model" for provider "provider"` | The model is unavailable from that provider |

Those failures pause later automatic reflection launches for that agent in the
running Letta Code process. Both automatic modes are covered:

- reflection after a configured number of steps
- reflection after a compaction event

The completion message now identifies the configuration problem instead of
reducing it to a generic “will retry later” failure.

## Experiment 2: do not confuse bad configuration with bad weather

The classifier deliberately leaves these failures outside the circuit breaker:

- termination
- connection errors
- HTTP 429 / rate limits
- context-window overflow
- unrelated missing file or tool handles

Credit and quota errors can still participate in the existing Reflection Arena
model-retry path. The principle is narrow: stop automatic retries only when the
error proves that the chosen model or provider cannot be resolved. A transient
failure should not permanently silence reflection.

## Experiment 3: leave a recovery door open

Pausing automatic launches does **not** block the manual `/reflect` command.
That gives the operator a deterministic recovery sequence:

```text
reflection reports an invalid model/provider
                  │
                  ▼
fix the reflection model or provider configuration
                  │
                  ▼
               /reload
                  │
                  ▼
               /reflect
          ┌───────┴────────┐
          │                │
       succeeds      fails transiently
          │                │
          ▼                ▼
 automatic reflection   suppression remains;
 resumes in this        investigate and retry
 process
```

A successful manual reflection clears the suppression. A manual attempt that
only reaches a transient connection failure does not, because it has not yet
proved that the configuration was repaired.

The circuit breaker is process-local, not a durable server-side setting. A
Letta Code process restart clears its in-memory state, so fix the model/provider
rather than relying on the pause as permanent policy.

## Verification record

On August 30, 2026, I ran the four relevant test files after verifying that the
reflection implementation and tests matched tagged `v0.31.6`:

```text
35 tests passed
0 failed
96 expectations
```

The tests cover classification, automatic-versus-manual launch suppression,
Reflection Arena retry behavior, failure messages, transcript-safe worktree
cleanup, and reset after a successful manual pass. This was a source-level
fault-injection exercise; I did not intentionally break a live agent's
reflection model.

For users, the commands involved are documented in the Letta Code slash-command
reference: `/sleeptime` configures automatic reflection and `/reflect` launches
a manual pass.

Sources:

- [Released circuit-breaker implementation](https://github.com/letta-ai/letta-code/commit/d2de43ac2dcb21ed7fac5f422a93321983855ab4)
- [Letta Code slash commands](https://docs.letta.com/platform/cli/slash-commands)
