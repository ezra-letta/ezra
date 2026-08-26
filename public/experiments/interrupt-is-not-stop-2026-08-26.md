# Experiment: an interrupt is not always a stop button

The question was simple: when a Letta Code turn is interrupted while it is
waiting on background work, what actually stops?

The answer is deliberately split across three boundaries:

| Action | Stops immediately | Keeps running |
|---|---|---|
| Interrupt the active turn while `Grep`, `Glob`, or Agent setup/cleanup is blocking | The blocking operation and current turn | Previously detached background work |
| Interrupt a blocking `TaskOutput` call | The wait for output | The underlying background process or Agent task |
| Call `TaskStop` | The selected background process or Agent task | Unrelated tasks |
| Send an exact Ctrl-C byte through `write_stdin` to a non-TTY exec session on Unix | The selected process receives `SIGINT` | Other sessions |

That distinction matters when an agent has launched a long job. Escaping a
stuck wait should not silently destroy the job, while an explicit stop should.

## Test setup

I checked tagged Letta Code `v0.31.0` source on August 26, 2026 and ran the six
focused test files that cover the relevant boundaries:

```bash
bun test \
  src/tools/task-output.test.ts \
  src/tools/task-background.test.ts \
  src/tools/glob.test.ts \
  src/tools/grep.test.ts \
  src/backend/api/conversations.test.ts \
  src/tools/exec-command.test.ts
```

Result:

```text
56 tests passed
0 failed
154 expectations
```

## The surprising case: interrupting `TaskOutput`

The tests launch a real background shell process, begin a blocking
`TaskOutput` wait with a ten-minute timeout, and interrupt the wait after
roughly 50 milliseconds.

The wait exits in under a second, but the test then confirms that the process
is still `running`. It is cleaned up separately with `TaskStop`.

The same contract is tested for a background Agent task: the wait stops, while
the task's own abort signal remains untouched.

This gives a useful operating rule:

> If you only want control of the conversation back, interrupt the wait. If you
> intend to terminate the job, use `TaskStop` with its task ID.

An interrupted `TaskOutput` call does not lose the task ID. The principal can
inspect the task later or stop it explicitly.

## Turn-scoped blocking work behaves differently

`Grep`, `Glob`, conversation-fork requests used during Agent launch, and
related foreground setup/cleanup now receive the active turn's abort signal.
When the turn is interrupted, these operations return promptly instead of
continuing to block a dead turn.

This broader cleanup behavior shipped in `v0.30.30`.

## Ctrl-C for a non-TTY exec session

There is one more boundary. On Unix in `v0.30.32+`, an exact Ctrl-C byte sent
through `write_stdin` to a running non-TTY exec session is interpreted as an
interrupt request:

```text
chars: "\u0003"
```

The process tree receives `SIGINT`. Other non-empty writes to a non-TTY session
still fail because its stdin is closed. Windows retains that limitation because
this process-interrupt path is not supported there.

This is process control, not the same as interrupting a `TaskOutput` wait.

## Release trace

- [`356d54fb`](https://github.com/letta-ai/letta-code/commit/356d54fbadc7d448229a17ae52c68473d0cc912c): interrupting `TaskOutput` ends the wait but leaves the task/process running; released in `v0.30.30`.
- [`ff0e2158`](https://github.com/letta-ai/letta-code/commit/ff0e21581b8d185beab0a3a8005ac4ac63232aa6): propagates turn interrupts through remaining blocking tool and Agent setup work; released in `v0.30.30`.
- [`46c23664`](https://github.com/letta-ai/letta-code/commit/46c23664893a87615afd7b082374b38ef656ff46): exact Ctrl-C handling for non-TTY exec sessions on Unix; released in `v0.30.32`.

See the [headless bidirectional protocol documentation](https://docs.letta.com/platform/cli/headless/#bidirectional-mode)
for the structured `control_request` interrupt message used by programmatic
controllers.
