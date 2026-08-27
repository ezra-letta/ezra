# Agent SDK `ready()` timing probe

Pre-initialize a Local, Remote, or Cloud Agent SDK session before announcing
that your application is ready for user input.

This demo measures session startup separately from a model turn. By default it
calls `ready()` only: it does **not** fetch transcript history, submit a user
message, or invoke the model.

## Why this exists

Agent SDK sessions initialize lazily. A first `send()` can include runtime and
transport startup before the message is submitted. Meanwhile,
`SDKResultMessage.durationMs` measures the tracked turn and excludes that
initialization.

If an app compares wall-clock latency with `durationMs` without separating
startup, it can assign the difference to the wrong stage.

Agent SDK `0.7.6+` provides `await session.ready()` for this boundary. It is
idempotent, concurrent callers share one initialization, and the resolved value
reports the agent ID, conversation ID, model, and loaded tool names when
available.

## Setup

Requirements:

- Node.js 22.19+
- A Letta Cloud API key in `LETTA_API_KEY`
- An existing agent or concrete conversation ID

```bash
cd demos/agent-sdk-ready-probe
npm install
export LETTA_API_KEY='...'
```

Do not commit `.env` files or API keys.

## Readiness-only probe

Resume an agent's default conversation:

```bash
npm run probe -- --agent agent-...
```

Or resume an exact conversation:

```bash
npm run probe -- --conversation conv-...
```

Expected shape:

```text
Runtime ready
  wall time: 842.7 ms
  concurrent ready() calls: 3
  identical results: yes
  agent: agent-...
  conversation: default
  model: provider/model
  tools loaded: 18

No model turn requested.
```

The three simultaneous calls are intentional. They demonstrate that callers
from several application components can safely share the same initialization.
An exact `--conversation conv-...` target reports that concrete ID instead of
the agent's virtual `default` conversation.

For automation:

```bash
npm --silent run probe -- --conversation conv-... --json
```

## Optional model-turn comparison

Adding `--message` performs one real model turn and may incur provider usage:

```bash
npm run probe -- \
  --conversation conv-... \
  --message 'Reply with READY and nothing else.'
```

The report keeps three measurements separate:

1. **`ready()` wall time** — runtime and transport initialization.
2. **`send()` submission time** — time until the SDK has submitted the input;
   `send()` does not wait for the completed response.
3. **Turn wall time vs. `durationMs`** — full observed turn time versus the
   SDK's tracked duration, which excludes session initialization.

A gap between any two values proves only that untracked time exists. It does
not identify queueing, network, runtime dispatch, provider inference, retry, or
tool execution without additional traces.

## Run the offline tests

```bash
npm test
```

The tests use a fake session and never contact Letta Cloud or invoke a model.
They cover argument safety, readiness-only behavior, duration separation, and
cleanup after failed initialization.

Verification on August 27, 2026:

- Four offline demo tests passed.
- A real Cloud readiness-only run made three concurrent `ready()` calls. All
  three returned identical runtime information after one 46.1-second cold
  initialization; no model turn was requested.

Cold-start time varies by account, region, runtime state, and execution target.
The measured value is evidence that the timing boundary works, not a benchmark
or latency promise.

## Adaptation pattern

In an application, call `ready()` while showing a startup screen, then enable
the composer only after it resolves:

```typescript
const session = client.resumeSession(conversationId);
const info = await session.ready();

showReady({
  conversationId: info.conversationId,
  model: info.model,
  tools: info.tools,
});
```

Keep the session open and reuse it for later turns. Do not call `ready()` and
immediately close the session if the goal is to prewarm future input.

## Scope

- `ready()` is available in `@letta-ai/letta-agent-sdk` `0.7.6+`; this demo
  pins `0.7.7` for reproducibility.
- The same API covers Local, Remote App Server, and Cloud sessions. This demo's
  executable entry point selects Cloud for a short copyable example.
- `ready()` does not fetch history. Use `bootstrapState()` separately when the
  UI also needs transcript hydration.
- The package currently pins Letta Code `0.30.28`; installing the newest SDK
  does not upgrade a separately installed Letta Code CLI.

## Dependency note

On August 27, 2026, `npm audit --omit=dev` reported a high-severity inherited
`sharp`/libvips advisory through the SDK's pinned Letta Code dependency, with no
fix available in the published dependency tree. This probe does not process
images, but production adopters should review the current package audit and
upgrade when a patched SDK dependency is released rather than treating this
small demo as a security review.

Sources:

- [Agent SDK repository](https://github.com/letta-ai/letta-agent-sdk)
- [`ready()` release tag](https://github.com/letta-ai/letta-agent-sdk/releases/tag/v0.7.6)
- [Agent SDK quickstart](https://docs.letta.com/agent-sdk/quickstart/)
