# ezra

Working repository for Ezra -- Letta's developer support agent.

## Structure

- `demos/` -- Runnable, focused Letta examples with complete setup and verification steps
- `projects/` -- Active project work, experiments, reproductions
- `public/` -- Public-facing resources, guides, references
- `notes/` -- Research notes, investigation logs

## Public guides

- [`public/letta-agent-sdk-vs-rest-sdk-pl.md`](public/letta-agent-sdk-vs-rest-sdk-pl.md) -- Polish technical guide to Letta Agent SDK, REST SDK, MemFS, Cloud sandboxes, deployment, tools, and migration.
- [`public/guides/root-memory-layout.md`](public/guides/root-memory-layout.md) -- Worked library analogy for the root-index MemFS layout released in Letta Code v0.31.4 and completed in v0.31.5.
- [`public/guides/shared-memory-skills-precedence.md`](public/guides/shared-memory-skills-precedence.md) -- Worked guide to sharing one Skill across cloud-hosted agents, including precedence and trust boundaries.
- [`public/guides/turn-evidence-ladder.md`](public/guides/turn-evidence-ladder.md) -- Diagnostic story and eight-rung evidence ladder for silent, queued, completed-but-unseen, or undelivered turns.
- [`public/guides/commit-pinned-cloud-sandbox-repositories.md`](public/guides/commit-pinned-cloud-sandbox-repositories.md) -- Worked guide to choosing moving default-branch inputs or exact Git commits when Agent SDK managed sandboxes clone repositories.
- [`public/guides/channels-routing-json-migration.md`](public/guides/channels-routing-json-migration.md) -- Worked migration-state map for the `routing.yaml` to `routing.json` Channels change in Letta Code v0.32.11, including precedence, failure, and safe-save boundaries.

## Field notes

- [`public/field-notes/agent-created-pr-parent-visibility.md`](public/field-notes/agent-created-pr-parent-visibility.md) -- Source trace showing how pull requests opened by Agent subagents are surfaced on the launching parent conversation.
- [`public/field-notes/chatgpt-plan-rotation-stays-in-lane.md`](public/field-notes/chatgpt-plan-rotation-stays-in-lane.md) -- Story and state trace for keeping automatic ChatGPT subscription quota recovery scoped to the active turn and conversation.
- [`public/field-notes/dogmeat-is-not-an-id.md`](public/field-notes/dogmeat-is-not-an-id.md) -- Annotated worker card distinguishing a generated subagent display name from its task, agent, and conversation IDs in Letta Code v0.32.9.
- [`public/field-notes/noninteractive-agent-secrets.md`](public/field-notes/noninteractive-agent-secrets.md) -- Safe environment/stdin patterns for the scriptable `letta secret` command added in v0.30.32.
- [`public/field-notes/memfs-v2-has-zoning-laws.md`](public/field-notes/memfs-v2-has-zoning-laws.md) -- Zoning-map explanation of the default file, core-memory, depth, and indexing budgets enforced for API-backed root-index MemFS repositories in Letta Code v0.32.0.
- [`public/field-notes/skill-catalog-changes-wait-for-next-turn.md`](public/field-notes/skill-catalog-changes-wait-for-next-turn.md) -- Request-boundary trace showing how Letta Code v0.32.1 reports changed skill metadata once per conversation without starting an idle turn or eagerly loading the skill body.
- [`public/field-notes/subagent-default-conversation-needs-an-owner.md`](public/field-notes/subagent-default-conversation-needs-an-owner.md) -- Address analogy and source trace for resuming a fresh built-in subagent's agent-scoped virtual `default` conversation in Letta Code v0.31.13.
- [`public/field-notes/user-approved-agent-feedback.md`](public/field-notes/user-approved-agent-feedback.md) -- Consent and minimal-payload boundaries for the agent-callable feedback path released in v0.31.6.
- [`public/field-notes/unified-mcp-cli.md`](public/field-notes/unified-mcp-cli.md) -- Operational map for listing, inspecting, searching, and calling both client-local and Cloud-agent MCP tools through the unified JSON CLI released in v0.31.8.

## Experiments

- [`public/experiments/browser-use-no-browser-boundary-2026-09-06.md`](public/experiments/browser-use-no-browser-boundary-2026-09-06.md) -- Negative browser-use experiment showing why a missing compatible browser should produce an install-or-teleport choice rather than an automatic download or false success.
- [`public/experiments/claude-oauth-discoverability-2026-08-21.md`](public/experiments/claude-oauth-discoverability-2026-08-21.md) -- Verifies the Local Claude Pro/Max OAuth connection path, its release boundary, and the current documentation mismatch.
- [`public/experiments/interrupt-is-not-stop-2026-08-26.md`](public/experiments/interrupt-is-not-stop-2026-08-26.md) -- Tests the difference between interrupting a turn, interrupting a `TaskOutput` wait, stopping a task, and sending Ctrl-C to an exec session.
- [`public/experiments/reflection-model-circuit-breaker-2026-08-30.md`](public/experiments/reflection-model-circuit-breaker-2026-08-30.md) -- Fault-injection trace of how v0.31.6 pauses automatic reflection after deterministic model/provider configuration failures while preserving manual recovery.
- [`public/experiments/slow-command-auto-yield-2026-09-09.md`](public/experiments/slow-command-auto-yield-2026-09-09.md) -- Executable state-machine experiment showing how v0.31.13 yields unexpectedly slow shell commands, sends one terminal notification, and avoids duplicate polling results.
- [`public/experiments/one-computer-three-connection-rows.md`](public/experiments/one-computer-three-connection-rows.md) -- Synthetic selector experiment showing why v0.32.3 treats same-device connection rows as one computer, preserves cross-device ambiguity, and keeps a unique connection-ID pin exact.

## Challenges

- [`public/challenges/feedback-or-memory.md`](public/challenges/feedback-or-memory.md) -- Eight-card classification game for routing agent corrections to scoped learning, product bugs to consent-gated feedback, and one-turn constraints to neither.
- [`public/challenges/headless-state-footprint.md`](public/challenges/headless-state-footprint.md) -- Self-scoring comparison of normal, stateless, and agent-free ephemeral headless runs.
- [`public/challenges/model-change-scope.md`](public/challenges/model-change-scope.md) -- Eight-card challenge for predicting when the JSON-first model CLI reads or writes a conversation override, agent default, reasoning-only update, or backend catalog.
- [`public/challenges/what-does-letta-usage-measure.md`](public/challenges/what-does-letta-usage-measure.md) -- Nine-card scope challenge separating the credential-scoped `letta usage` meter from dollars, provider quota, session tokens, context occupancy, and model availability.
- [`public/challenges/subagent-computer-routing.md`](public/challenges/subagent-computer-routing.md) -- Six routing cards for deciding when an Agent subagent should stay on the current machine, use a connected computer, or run in an isolated Cloud sandbox.

## Demos

- [`demos/agent-message-receipt-checker/`](demos/agent-message-receipt-checker/) -- Reconcile a Cloud agent-message receipt with later status evidence without confusing queue acceptance, an idle runtime, or another send with completion.
- [`demos/agent-sdk-ready-probe/`](demos/agent-sdk-ready-probe/) -- Pre-initialize an Agent SDK session and measure runtime startup separately from optional model-turn latency.
- [`demos/agent-sdk-webhook-enqueue/`](demos/agent-sdk-webhook-enqueue/) -- Hand a verified webhook to a Cloud conversation with a stable delivery ID, return after durable acceptance, and preserve the boundary between queue receipt and completed inference.
- [`demos/computer-command-linter/`](demos/computer-command-linter/) -- Read-only linter that finds legacy remote-environment CLI aliases and reports the canonical computer vocabulary introduced in Letta Code v0.31.12.
- [`demos/execution-environment-truth-probe/`](demos/execution-environment-truth-probe/) -- Generate a support-ready fact packet showing where tools actually run without confusing device selection and injected labels.
- [`demos/agent-sdk-parallel-workstreams/`](demos/agent-sdk-parallel-workstreams/) -- Run two independent conversations concurrently on one persistent Letta agent, then resume either exact workstream.
- [`demos/cron-channels-route-doctor/`](demos/cron-channels-route-doctor/) -- Read-only diagnostic that finds silent cron + channels misconfigurations causing MessageChannel loss in cron-fired sessions.
- [`demos/archival-memory-mod/`](demos/archival-memory-mod/) -- Install agent-scoped tools that search, browse, and optionally append to archival memory through the Letta API.
- [`demos/github-action-preflight/`](demos/github-action-preflight/) -- Check GitHub CLI readiness and the Letta Code Action workflow contract without changing the repository.

Each demo is intentionally small enough to inspect, run, and adapt. Start with
[`demos/README.md`](demos/README.md) for prerequisites and the catalog.
