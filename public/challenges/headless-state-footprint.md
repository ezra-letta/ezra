# Headless state-footprint challenge

Three Letta Code commands can all look like “run one prompt.” They leave very
different footprints.

Before opening the answer key, predict which command:

- uses an existing agent's durable identity;
- skips MemFS for this launch but still requires an existing agent;
- creates no public agent at all;
- can continue an existing conversation;
- is restricted to one direct headless turn.

## The three boxes

Replace the placeholder model and agent ID with values available to your
account. You do not need to run these to complete the paper challenge.

### Box A

```bash
letta -p "Inventory this repository" --agent <agent-id>
```

### Box B

```bash
letta -p "Inventory this repository" \
  --agent <agent-id> \
  --stateless
```

### Box C

```bash
letta -p "Inventory this repository" \
  --ephemeral \
  -m <model-handle>
```

Write A, B, or C beside each statement:

1. ___ Uses the selected agent's normal persistent context and MemFS workflow.
2. ___ Still requires `--agent`, `--name`, or `--conversation`.
3. ___ Has no public agent, memory blocks, MemFS, or reflection.
4. ___ Cannot combine with agent or conversation selectors.
5. ___ Is the right fit for an identity-free one-shot harness run.
6. ___ Is the right fit for temporarily skipping MemFS work on an existing
   agent without converting that agent into an ephemeral one.

## Answer key

| Box | Identity | Memory behavior | Conversation behavior | Main use |
|---|---|---|---|---|
| **A** | Existing persistent agent | Normal agent memory and MemFS path | Uses/resumes agent conversation state | Ordinary automated work by a stateful agent |
| **B** | Existing persistent agent | Skips MemFS hydration/sync and reflection for this launch | Still runs the selected existing agent/conversation | A deliberate agent-backed launch without MemFS work |
| **C** | No public agent | No memory blocks, MemFS, or reflection | Direct one-shot ephemeral conversation | Identity-free temporary execution |

Answers: **1 A, 2 B, 3 C, 4 C, 5 C, 6 B.**

The trap is the name `--stateless`. It does **not** mean “create no agent.” It
means “run this existing agent without MemFS enablement or sync for this
headless launch.” That is why it requires an existing agent selector.

`--ephemeral` is the agent-free mode.

## What `--ephemeral` leaves behind

The backend matters:

- **Cloud:** creates an agent-free conversation (`agent_id: null`) rather than
  a public agent.
- **Local:** uses a temporary isolated backend store removed when the process
  exits. The verified integration test created no persistent `agents/`,
  `conversations/`, or `memfs/` directories in the configured Local store.

This is still a capable harness turn. The toolset is derived from the selected
model family, so ephemeral does not mean “text completion with all tools
removed.” It means the execution is not backed by a durable Letta identity or
memory system.

## Guardrails

`--ephemeral` is intentionally narrow:

- headless mode only;
- direct one-shot prompts only;
- cannot combine with `--agent`, `--name`, `--conversation`, `--new-agent`, or
  `--new`;
- cannot combine with `--stateless`, MemFS startup flags, import, or resume;
- cannot use bidirectional stream input or Remote/Cloud-computer routing;
- cannot use a personality preset because there are no memory blocks.

Use a normal agent when the work should teach or continue an identity. Use
`--stateless` when an existing agent must run without MemFS work for one
launch. Use `--ephemeral` when persistence itself is unwanted.

## Evidence record

Agent-free ephemeral headless conversations shipped in Letta Code `v0.30.24`
through commit
[`f5f62382`](https://github.com/letta-ai/letta-code/commit/f5f62382379f294babc90250d378c12ed52efee4).

Verification run on August 24, 2026:

```text
11 focused unit tests passed (38 expectations)
1 Local end-to-end startup test passed (7 expectations)
```

The Local integration used a deterministic executor and an isolated backend;
it required no Cloud authentication and verified that persistent state
directories were not created.

References:

- [Headless mode documentation](https://docs.letta.com/platform/cli/headless/)
- [Ephemeral startup flag contract](https://github.com/letta-ai/letta-code/blob/main/src/cli/startup-flag-validation.ts)
- [Ephemeral conversation implementation](https://github.com/letta-ai/letta-code/blob/main/src/agent/ephemeral-conversation.ts)
