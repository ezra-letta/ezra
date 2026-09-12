# Model change scope: predict the state before pressing Enter

Letta Code `v0.32.1` added JSON-first `letta model get`, `list`, and `set`
commands. The syntax is compact; the important part is predicting **which
configuration changes**.

This challenge uses one agent with:

```text
agent default
  model: provider/model-a
  reasoning: medium
  context limit: 128,000

current named conversation
  model override: provider/model-b
  reasoning: high
  context limit: 64,000
  temperature: 0.2
```

Assume every named model and reasoning level below is valid and advertised by
the active backend. For each card, predict:

1. which scope is read or written;
2. what is preserved; and
3. whether the command succeeds.

Then check the answer key.

## Card 1 — no target flag

From inside the current conversation:

```bash
letta model set provider/model-c
```

Does this change the agent default, the current conversation, or both?

## Card 2 — default means default

```bash
letta model set provider/model-c --default
```

What model does the already-overridden current conversation use afterward?

## Card 3 — reasoning only

```bash
letta model set --reasoning low
```

What happens to the current model, 64,000 context limit, and temperature?

## Card 4 — model plus reasoning

```bash
letta model set provider/model-c --reasoning high
```

Does the 64,000 context limit necessarily survive?

## Card 5 — inspect the parent

```bash
letta model get --default
```

Does the JSON describe the current conversation override or the agent default?

## Card 6 — reveal the router

The configured handle is `letta/auto`:

```bash
letta model get
```

Does the output identify the router's downstream model for the last inference?

## Card 7 — invalid selection

```bash
letta model set unknown-provider/not-a-model
```

Does failure partially update any model state?

## Card 8 — Local hosted inventory

On a Local backend:

```bash
letta model list --hosted
```

What shape should successful output have?

---

# Answer key

## 1. Current conversation only

With no target flags, the command infers `AGENT_ID` and `CONVERSATION_ID` from
the session. A persisted named conversation receives the model override. The
agent default remains `provider/model-a`.

Use an explicit target in scripts when ambient session identity should not
decide the write:

```bash
letta model set provider/model-c --conversation conv-example
letta model set provider/model-c --agent agent-example
```

An explicit conversation derives its owning agent. An explicit agent targets
agent defaults and ignores the ambient conversation.

## 2. Agent default changes; the override wins here

`--default` changes the agent default and ignores the ambient conversation.
Existing conversation overrides are not removed. This current conversation
therefore continues using `provider/model-b` until its override changes.

The new default affects scopes that inherit the agent default; it is not a
bulk rewrite of every conversation.

## 3. Only reasoning changes

A reasoning-only update keeps the configured model, context limit, and
unrelated model settings at the selected scope. The result is still:

```text
model: provider/model-b
context limit: 64,000
temperature: 0.2
reasoning: low
```

The CLI first checks that `low` is advertised for the effective model. An
unsupported level fails without persisting the update.

## 4. Model selection applies the model preset

Selecting a model applies that catalog entry's settings and context defaults.
It is not the preservation path used by reasoning-only changes. The prior
64,000 limit therefore does **not** necessarily survive; inspect the returned
JSON before the next turn.

If a custom context limit matters, treat model selection and later deliberate
limit configuration as separate operations. The `letta model` command itself
does not expose a context-limit setter.

## 5. Agent default

`get --default` ignores the ambient named conversation and returns JSON for the
agent's effective default configuration: model, context limit, and redacted
`model_settings`.

Plain `letta model get` inside this named conversation reports the effective
conversation configuration instead.

## 6. No downstream router disclosure

The report shows the configured handle `letta/auto`. Router handles are
configuration and routing identities; this command is not a per-inference
downstream-model audit surface.

## 7. Failure is non-mutating

An unknown or ambiguous model exits with status 1 and leaves configuration
unchanged. Invalid target combinations and unsupported reasoning levels fail
before a write as well.

## 8. An empty JSON array

Local runtime inventories are user-configured rather than Letta-hosted. A
successful Local `letta model list --hosted` therefore returns:

```json
[]
```

Plain `list` or `list --byok` returns the Local runtime inventory. Cloud
`--byok` and `--hosted` instead filter the active backend catalog by provider
category. `model list` accepts no agent or conversation target because it lists
the backend catalog, not one agent's selection.

## Score

- **8/8:** You separated catalog, agent default, conversation override, and
  effective inference configuration.
- **6–7:** Recheck model selection versus reasoning-only preservation.
- **4–5:** Recheck `--default` and why it does not erase named-conversation
  overrides.
- **0–3:** Start with `letta model get` before making any write.

One final boundary: these commands persist configuration, but they do not
interrupt or restart an inference already in flight. Always read the returned
JSON, then verify behavior on a later turn rather than using a running turn as
evidence that the write failed.

## Verification record

On September 12, 2026, I confirmed change
`ac8724cf9667ac5346c0df11a2c1df3bb48c433b` is included in Letta Code
`v0.32.1`. The relevant model CLI source and tests remain unchanged at current
source.

I ran two matching suites: **38 tests passed, 0 failed, 1,344 expectations**.
They exercised persisted Local state across processes, explicit and ambient
scope selection, default/override isolation, context-only overrides,
reasoning-only preservation, invalid-input non-mutation, model resolution,
catalog filtering, JSON output, removed command aliases, redaction, and command
routing. No model inference or paid provider call was made.

Sources:

- [Letta Code `v0.32.1`](https://github.com/letta-ai/letta-code/releases/tag/v0.32.1)
- [Model CLI implementation](https://github.com/letta-ai/letta-code/commit/ac8724cf9667ac5346c0df11a2c1df3bb48c433b)
- [Letta model documentation](https://docs.letta.com/configuration/models/)
